package com.boardarena.app;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "BoardArenaLan")
public class BoardArenaLanPlugin extends Plugin {
    private static final int MAX_MESSAGE_CHARS = 16_384;
    private final ExecutorService io = Executors.newCachedThreadPool();
    private final ConcurrentHashMap<String, Socket> sockets = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, BufferedWriter> writers = new ConcurrentHashMap<>();
    private final Object hostLock = new Object();

    private ServerSocket serverSocket;
    private volatile boolean hosting;
    private NsdManager nsd;
    private NsdManager.RegistrationListener registrationListener;
    private NsdManager.DiscoveryListener discoveryListener;
    private String serviceType;
    private String serviceName;
    private int boundPort;
    private Map<String, String> metadata = new HashMap<>();

    @Override
    public void load() {
        nsd = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
    }

    @PluginMethod
    public void startHost(PluginCall call) {
        int requestedPort = call.getInt("port", 8765);
        String requestedType = call.getString("serviceType", "_boardarena._tcp.");
        String requestedName = call.getString("serviceName", "Board Arena");
        JSObject requestedMetadata = call.getObject("metadata", new JSObject());
        if (requestedPort < 1 || requestedPort > 65535 || requestedType.length() > 80 || requestedName.length() > 63) {
            call.reject("invalid-lan-host-options");
            return;
        }
        Map<String, String> nextMetadata = objectToStrings(requestedMetadata);
        io.execute(() -> {
            synchronized (hostLock) {
                try {
                    stopHostInternal();
                    serverSocket = new ServerSocket(requestedPort);
                    serverSocket.setReuseAddress(true);
                    hosting = true;
                    boundPort = serverSocket.getLocalPort();
                    serviceType = requestedType;
                    serviceName = requestedName;
                    metadata = nextMetadata;
                    registerService();
                    io.execute(this::acceptLoop);
                    JSObject result = new JSObject();
                    result.put("host", localAddress());
                    result.put("port", boundPort);
                    call.resolve(result);
                } catch (Exception error) {
                    stopHostInternal();
                    call.reject("lan-host-failed", error);
                }
            }
        });
    }

    @PluginMethod
    public void updateHost(PluginCall call) {
        JSObject requested = call.getObject("metadata", new JSObject());
        synchronized (hostLock) {
            if (!hosting) {
                call.reject("lan-host-not-running");
                return;
            }
            metadata = objectToStrings(requested);
            try {
                unregisterService();
                registerService();
                call.resolve();
            } catch (Exception error) {
                call.reject("lan-advertise-failed", error);
            }
        }
    }

    @PluginMethod
    public void stopHost(PluginCall call) {
        synchronized (hostLock) {
            stopHostInternal();
        }
        call.resolve();
    }

    @PluginMethod
    public void startDiscovery(PluginCall call) {
        String requestedType = call.getString("serviceType", "_boardarena._tcp.");
        stopDiscoveryInternal();
        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override public void onDiscoveryStarted(String regType) {}
            @Override public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                stopDiscoveryInternal();
            }
            @Override public void onStopDiscoveryFailed(String serviceType, int errorCode) {}
            @Override public void onDiscoveryStopped(String serviceType) {}
            @Override public void onServiceFound(NsdServiceInfo serviceInfo) {
                if (!serviceInfo.getServiceType().equals(requestedType)) return;
                try {
                    nsd.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                        @Override public void onResolveFailed(NsdServiceInfo info, int errorCode) {}
                        @Override public void onServiceResolved(NsdServiceInfo resolved) {
                            InetAddress host = resolved.getHost();
                            if (host == null || resolved.getPort() < 1) return;
                            JSObject event = new JSObject();
                            event.put("name", resolved.getServiceName());
                            event.put("host", host.getHostAddress());
                            event.put("port", resolved.getPort());
                            for (Map.Entry<String, byte[]> entry : resolved.getAttributes().entrySet()) {
                                event.put(entry.getKey(), new String(entry.getValue(), StandardCharsets.UTF_8));
                            }
                            notifyListeners("serviceFound", event, true);
                        }
                    });
                } catch (Exception ignored) {}
            }
            @Override public void onServiceLost(NsdServiceInfo serviceInfo) {
                JSObject event = new JSObject();
                event.put("name", serviceInfo.getServiceName());
                notifyListeners("serviceLost", event, true);
            }
        };
        try {
            nsd.discoverServices(requestedType, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
            call.resolve();
        } catch (Exception error) {
            discoveryListener = null;
            call.reject("lan-discovery-failed", error);
        }
    }

    @PluginMethod
    public void stopDiscovery(PluginCall call) {
        stopDiscoveryInternal();
        call.resolve();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String host = call.getString("host", "").trim();
        int port = call.getInt("port", 8765);
        if (host.isEmpty() || host.length() > 253 || port < 1 || port > 65535) {
            call.reject("invalid-lan-address");
            return;
        }
        io.execute(() -> {
            try {
                Socket socket = new Socket();
                socket.connect(new java.net.InetSocketAddress(host, port), 6000);
                socket.setTcpNoDelay(true);
                socket.setKeepAlive(true);
                String id = UUID.randomUUID().toString();
                attach(id, socket, false);
                JSObject result = new JSObject();
                result.put("connectionId", id);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("lan-address-unreachable", error);
            }
        });
    }

    @PluginMethod
    public void send(PluginCall call) {
        String id = call.getString("connectionId", "");
        String data = call.getString("data", "");
        if (data.length() > MAX_MESSAGE_CHARS || data.indexOf('\n') >= 0 || data.indexOf('\r') >= 0) {
            call.reject("lan-message-too-large");
            return;
        }
        BufferedWriter writer = writers.get(id);
        if (writer == null) {
            call.reject("lan-not-connected");
            return;
        }
        io.execute(() -> {
            try {
                synchronized (writer) {
                    writer.write(data);
                    writer.write('\n');
                    writer.flush();
                }
                call.resolve();
            } catch (IOException error) {
                closeConnection(id, "send-failed");
                call.reject("lan-send-failed", error);
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeConnection(call.getString("connectionId", ""), "closed");
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        stopDiscoveryInternal();
        synchronized (hostLock) {
            stopHostInternal();
        }
        for (String id : sockets.keySet()) closeConnection(id, "destroyed");
        io.shutdownNow();
        super.handleOnDestroy();
    }

    private void acceptLoop() {
        while (hosting && serverSocket != null && !serverSocket.isClosed()) {
            try {
                Socket socket = serverSocket.accept();
                socket.setTcpNoDelay(true);
                socket.setKeepAlive(true);
                String id = UUID.randomUUID().toString();
                attach(id, socket, true);
            } catch (IOException error) {
                if (hosting) {
                    JSObject event = new JSObject();
                    event.put("connectionId", "");
                    event.put("reason", "accept-failed");
                    notifyListeners("disconnected", event, true);
                }
                return;
            }
        }
    }

    private void attach(String id, Socket socket, boolean accepted) throws IOException {
        sockets.put(id, socket);
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(), StandardCharsets.UTF_8));
        writers.put(id, writer);
        if (accepted) {
            JSObject event = new JSObject();
            event.put("connectionId", id);
            event.put("host", socket.getInetAddress().getHostAddress());
            notifyListeners("clientConnected", event, true);
        }
        io.execute(() -> readLoop(id, socket));
    }

    private void readLoop(String id, Socket socket) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.UTF_8))) {
            while (!socket.isClosed()) {
                String line = readBoundedLine(reader);
                if (line == null) break;
                JSObject event = new JSObject();
                event.put("connectionId", id);
                event.put("data", line);
                notifyListeners("message", event, true);
            }
            closeConnection(id, "closed");
        } catch (Exception error) {
            closeConnection(id, "read-failed");
        }
    }

    private String readBoundedLine(BufferedReader reader) throws IOException {
        StringBuilder out = new StringBuilder();
        while (true) {
            int ch = reader.read();
            if (ch == -1) return out.length() == 0 ? null : out.toString();
            if (ch == '\n') return out.toString();
            if (ch == '\r') continue;
            if (out.length() >= MAX_MESSAGE_CHARS) throw new IOException("message-too-large");
            out.append((char) ch);
        }
    }

    private void closeConnection(String id, String reason) {
        Socket socket = sockets.remove(id);
        writers.remove(id);
        if (socket == null) return;
        try { socket.close(); } catch (IOException ignored) {}
        JSObject event = new JSObject();
        event.put("connectionId", id);
        event.put("reason", reason);
        notifyListeners("disconnected", event, true);
    }

    private void registerService() {
        if (!hosting || nsd == null) return;
        NsdServiceInfo info = new NsdServiceInfo();
        info.setServiceName(serviceName);
        info.setServiceType(serviceType);
        info.setPort(boundPort);
        for (Map.Entry<String, String> entry : metadata.entrySet()) {
            String value = entry.getValue();
            if (entry.getKey().length() <= 9 && value.getBytes(StandardCharsets.UTF_8).length <= 128) {
                info.setAttribute(entry.getKey(), value);
            }
        }
        registrationListener = new NsdManager.RegistrationListener() {
            @Override public void onServiceRegistered(NsdServiceInfo serviceInfo) { serviceName = serviceInfo.getServiceName(); }
            @Override public void onRegistrationFailed(NsdServiceInfo serviceInfo, int errorCode) {}
            @Override public void onServiceUnregistered(NsdServiceInfo serviceInfo) {}
            @Override public void onUnregistrationFailed(NsdServiceInfo serviceInfo, int errorCode) {}
        };
        nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, registrationListener);
    }

    private void unregisterService() {
        if (registrationListener == null || nsd == null) return;
        try { nsd.unregisterService(registrationListener); } catch (Exception ignored) {}
        registrationListener = null;
    }

    private void stopHostInternal() {
        hosting = false;
        unregisterService();
        if (serverSocket != null) {
            try { serverSocket.close(); } catch (IOException ignored) {}
            serverSocket = null;
        }
        for (String id : sockets.keySet()) closeConnection(id, "host-stopped");
        boundPort = 0;
    }

    private void stopDiscoveryInternal() {
        if (discoveryListener != null && nsd != null) {
            try { nsd.stopServiceDiscovery(discoveryListener); } catch (Exception ignored) {}
        }
        discoveryListener = null;
    }

    private Map<String, String> objectToStrings(JSObject object) {
        if (object == null) return Collections.emptyMap();
        Map<String, String> out = new HashMap<>();
        for (String key : object.keys()) {
            Object value = object.opt(key);
            if (value != null) out.put(key, String.valueOf(value));
        }
        return out;
    }

    private String localAddress() throws Exception {
        Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
        while (interfaces.hasMoreElements()) {
            NetworkInterface network = interfaces.nextElement();
            if (!network.isUp() || network.isLoopback()) continue;
            Enumeration<InetAddress> addresses = network.getInetAddresses();
            while (addresses.hasMoreElements()) {
                InetAddress address = addresses.nextElement();
                if (address instanceof Inet4Address && !address.isLoopbackAddress() && address.isSiteLocalAddress())
                    return address.getHostAddress();
            }
        }
        interfaces = NetworkInterface.getNetworkInterfaces();
        while (interfaces.hasMoreElements()) {
            NetworkInterface network = interfaces.nextElement();
            if (!network.isUp() || network.isLoopback()) continue;
            Enumeration<InetAddress> addresses = network.getInetAddresses();
            while (addresses.hasMoreElements()) {
                InetAddress address = addresses.nextElement();
                if (!address.isLoopbackAddress() && !address.isLinkLocalAddress()) return address.getHostAddress();
            }
        }
        throw new IOException("no-local-address");
    }
}
