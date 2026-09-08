import Foundation
import Network
import Capacitor
import Darwin

@objc(BoardArenaLanPlugin)
public class BoardArenaLanPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BoardArenaLanPlugin"
    public let jsName = "BoardArenaLan"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startHost", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateHost", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopHost", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startDiscovery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopDiscovery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
    ]

    private let maxMessageBytes = 16_384
    private let defaultPort: UInt16 = 8765
    private let networkQueue = DispatchQueue(label: "com.boardarena.lan.network")
    private var listener: NWListener?
    private var browser: NWBrowser?
    private var hostServiceName = "Board Arena"
    private var hostServiceType = "_boardarena._tcp"
    private var hostMetadata: [String: String] = [:]
    private var pendingHostCall: CAPPluginCall?
    private var pendingConnectCalls: [String: CAPPluginCall] = [:]
    private var connections: [String: NWConnection] = [:]
    private var receiveBuffers: [String: Data] = [:]
    private var hostConnections = Set<String>()
    private var endpointTokens: [NWEndpoint: String] = [:]
    private var discoveredEndpoints: [String: NWEndpoint] = [:]

    @objc func startHost(_ call: CAPPluginCall) {
        let requestedPort = call.getInt("port") ?? Int(defaultPort)
        let requestedType = normalizedServiceType(call.getString("serviceType") ?? "_boardarena._tcp.")
        let requestedName = (call.getString("serviceName") ?? "Board Arena").trimmingCharacters(in: .whitespacesAndNewlines)
        guard requestedPort > 0, requestedPort <= 65_535,
              !requestedType.isEmpty, requestedType.count <= 80,
              !requestedName.isEmpty, requestedName.count <= 63,
              let port = NWEndpoint.Port(rawValue: UInt16(requestedPort)) else {
            call.reject("invalid-lan-host-options")
            return
        }

        let metadata = stringDictionary(call.getObject("metadata") ?? JSObject())
        networkQueue.async { [weak self] in
            guard let self else { return }
            self.stopHostInternal(reason: "host-restarted")
            do {
                let listener = try NWListener(using: .tcp, on: port)
                self.hostServiceName = requestedName
                self.hostServiceType = requestedType
                self.hostMetadata = metadata
                self.pendingHostCall = call
                listener.service = NWListener.Service(
                    name: requestedName,
                    type: requestedType,
                    domain: nil,
                    txtRecord: NWTXTRecord(metadata)
                )
                listener.newConnectionHandler = { [weak self] connection in
                    self?.networkQueue.async {
                        self?.attach(connection, id: UUID().uuidString, accepted: true, connectCall: nil)
                    }
                }
                listener.stateUpdateHandler = { [weak self] state in
                    guard let self else { return }
                    self.networkQueue.async {
                        switch state {
                        case .ready:
                            guard let pending = self.pendingHostCall else { return }
                            self.pendingHostCall = nil
                            let port = Int(listener.port?.rawValue ?? UInt16(requestedPort))
                            guard let host = self.localAddress() else {
                                listener.cancel()
                                self.listener = nil
                                pending.reject("no-local-address")
                                return
                            }
                            pending.resolve(["host": host, "port": port])
                        case .failed(let error):
                            if let pending = self.pendingHostCall {
                                self.pendingHostCall = nil
                                pending.reject("lan-host-failed", nil, error)
                            } else {
                                self.notifyListeners("disconnected", data: ["connectionId": "", "reason": "host-failed"], retainUntilConsumed: true)
                            }
                            self.stopHostInternal(reason: "host-failed")
                        case .cancelled:
                            if let pending = self.pendingHostCall {
                                self.pendingHostCall = nil
                                pending.reject("lan-host-cancelled")
                            }
                        default:
                            break
                        }
                    }
                }
                self.listener = listener
                listener.start(queue: self.networkQueue)
            } catch {
                self.pendingHostCall = nil
                call.reject("lan-host-failed", nil, error)
            }
        }
    }

    @objc func updateHost(_ call: CAPPluginCall) {
        let metadata = stringDictionary(call.getObject("metadata") ?? JSObject())
        networkQueue.async { [weak self] in
            guard let self, let listener = self.listener else {
                call.reject("lan-host-not-running")
                return
            }
            self.hostMetadata = metadata
            listener.service = NWListener.Service(
                name: self.hostServiceName,
                type: self.hostServiceType,
                domain: nil,
                txtRecord: NWTXTRecord(metadata)
            )
            call.resolve()
        }
    }

    @objc func stopHost(_ call: CAPPluginCall) {
        networkQueue.async { [weak self] in
            self?.stopHostInternal(reason: "host-stopped")
            call.resolve()
        }
    }

    @objc func startDiscovery(_ call: CAPPluginCall) {
        let serviceType = normalizedServiceType(call.getString("serviceType") ?? "_boardarena._tcp.")
        guard !serviceType.isEmpty, serviceType.count <= 80 else {
            call.reject("lan-discovery-failed")
            return
        }
        networkQueue.async { [weak self] in
            guard let self else { return }
            self.stopDiscoveryInternal()
            let browser = NWBrowser(for: .bonjourWithTXTRecord(type: serviceType, domain: nil), using: .tcp)
            browser.browseResultsChangedHandler = { [weak self] results, _ in
                self?.networkQueue.async {
                    self?.publishDiscoveryResults(results)
                }
            }
            browser.stateUpdateHandler = { state in
                if case .failed = state {
                    call.reject("lan-discovery-failed")
                }
            }
            self.browser = browser
            browser.start(queue: self.networkQueue)
            call.resolve()
        }
    }

    @objc func stopDiscovery(_ call: CAPPluginCall) {
        networkQueue.async { [weak self] in
            self?.stopDiscoveryInternal()
            call.resolve()
        }
    }

    @objc func connect(_ call: CAPPluginCall) {
        let host = (call.getString("host") ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let requestedPort = call.getInt("port") ?? Int(defaultPort)
        guard !host.isEmpty, host.count <= 253, requestedPort > 0, requestedPort <= 65_535,
              let port = NWEndpoint.Port(rawValue: UInt16(requestedPort)) else {
            call.reject("invalid-lan-address")
            return
        }
        networkQueue.async { [weak self] in
            guard let self else { return }
            let endpoint = self.discoveredEndpoints[host] ?? NWEndpoint.hostPort(host: NWEndpoint.Host(host), port: port)
            let connection = NWConnection(to: endpoint, using: .tcp)
            let id = UUID().uuidString
            self.attach(connection, id: id, accepted: false, connectCall: call)
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        let id = call.getString("connectionId") ?? ""
        networkQueue.async { [weak self] in
            self?.closeConnection(id, reason: "closed", emit: true)
            call.resolve()
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        let id = call.getString("connectionId") ?? ""
        let data = call.getString("data") ?? ""
        guard data.utf8.count <= maxMessageBytes,
              !data.contains("\n"), !data.contains("\r") else {
            call.reject("lan-message-too-large")
            return
        }
        networkQueue.async { [weak self] in
            guard let self, let connection = self.connections[id] else {
                call.reject("lan-not-connected")
                return
            }
            connection.send(content: Data((data + "\n").utf8), completion: .contentProcessed { [weak self] error in
                self?.networkQueue.async {
                    if let error {
                        self?.closeConnection(id, reason: "send-failed", emit: true)
                        call.reject("lan-send-failed", nil, error)
                    } else {
                        call.resolve()
                    }
                }
            })
        }
    }

    override public func load() {
        super.load()
    }

    deinit {
        browser?.cancel()
        listener?.cancel()
        for connection in connections.values { connection.cancel() }
    }

    private func attach(_ connection: NWConnection, id: String, accepted: Bool, connectCall: CAPPluginCall?) {
        connections[id] = connection
        receiveBuffers[id] = Data()
        if accepted { hostConnections.insert(id) }
        if let connectCall { pendingConnectCalls[id] = connectCall }
        connection.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            self.networkQueue.async {
                switch state {
                case .ready:
                    if let pending = self.pendingConnectCalls.removeValue(forKey: id) {
                        pending.resolve(["connectionId": id])
                    }
                    if accepted {
                        self.notifyListeners("clientConnected", data: ["connectionId": id], retainUntilConsumed: true)
                    }
                    self.receiveNext(id)
                case .failed(let error):
                    if let pending = self.pendingConnectCalls.removeValue(forKey: id) {
                        pending.reject("lan-address-unreachable", nil, error)
                    }
                    self.closeConnection(id, reason: "connection-failed", emit: accepted || connectCall == nil)
                case .cancelled:
                    if let pending = self.pendingConnectCalls.removeValue(forKey: id) {
                        pending.reject("lan-address-unreachable")
                    }
                    self.closeConnection(id, reason: "closed", emit: false)
                default:
                    break
                }
            }
        }
        connection.start(queue: networkQueue)
    }

    private func receiveNext(_ id: String) {
        guard let connection = connections[id] else { return }
        connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] content, _, complete, error in
            guard let self else { return }
            self.networkQueue.async {
                if let content, !content.isEmpty {
                    var buffer = self.receiveBuffers[id] ?? Data()
                    buffer.append(content)
                    if buffer.count > self.maxMessageBytes && !buffer.contains(0x0A) {
                        self.closeConnection(id, reason: "message-too-large", emit: true)
                        return
                    }
                    while let newline = buffer.firstIndex(of: 0x0A) {
                        let lineSlice = buffer[buffer.startIndex..<newline]
                        buffer.removeSubrange(buffer.startIndex...newline)
                        if lineSlice.count > self.maxMessageBytes {
                            self.closeConnection(id, reason: "message-too-large", emit: true)
                            return
                        }
                        let lineData = Data(lineSlice.filter { $0 != 0x0D })
                        guard let line = String(data: lineData, encoding: .utf8) else {
                            self.closeConnection(id, reason: "invalid-utf8", emit: true)
                            return
                        }
                        self.notifyListeners("message", data: ["connectionId": id, "data": line], retainUntilConsumed: true)
                    }
                    self.receiveBuffers[id] = buffer
                }
                if error != nil {
                    self.closeConnection(id, reason: "read-failed", emit: true)
                } else if complete {
                    self.closeConnection(id, reason: "closed", emit: true)
                } else {
                    self.receiveNext(id)
                }
            }
        }
    }

    private func closeConnection(_ id: String, reason: String, emit: Bool) {
        guard let connection = connections.removeValue(forKey: id) else { return }
        connection.cancel()
        receiveBuffers.removeValue(forKey: id)
        hostConnections.remove(id)
        pendingConnectCalls.removeValue(forKey: id)?.reject("lan-address-unreachable")
        if emit {
            notifyListeners("disconnected", data: ["connectionId": id, "reason": reason], retainUntilConsumed: true)
        }
    }

    private func stopHostInternal(reason: String) {
        pendingHostCall?.reject("lan-host-cancelled")
        pendingHostCall = nil
        listener?.cancel()
        listener = nil
        for id in Array(hostConnections) { closeConnection(id, reason: reason, emit: true) }
        hostConnections.removeAll()
    }

    private func stopDiscoveryInternal() {
        browser?.cancel()
        browser = nil
        endpointTokens.removeAll()
        discoveredEndpoints.removeAll()
    }

    private func publishDiscoveryResults(_ results: Set<NWBrowser.Result>) {
        let active = Set(results.map(\.endpoint))
        for endpoint in Array(endpointTokens.keys) where !active.contains(endpoint) {
            let token = endpointTokens.removeValue(forKey: endpoint)
            if let token { discoveredEndpoints.removeValue(forKey: token) }
            if case let .service(name, _, _, _) = endpoint {
                notifyListeners("serviceLost", data: ["name": name], retainUntilConsumed: true)
            }
        }

        for result in results {
            guard case let .service(name, _, _, _) = result.endpoint else { continue }
            let token = endpointTokens[result.endpoint] ?? "service-\(UUID().uuidString)"
            endpointTokens[result.endpoint] = token
            discoveredEndpoints[token] = result.endpoint
            var event: JSObject = [
                "name": name,
                "host": token,
                "port": Int(defaultPort),
            ]
            if case let .bonjour(txt) = result.metadata {
                for (key, value) in txt.dictionary { event[key] = value }
            }
            notifyListeners("serviceFound", data: event, retainUntilConsumed: true)
        }
    }

    private func normalizedServiceType(_ value: String) -> String {
        var type = value.trimmingCharacters(in: .whitespacesAndNewlines)
        while type.hasSuffix(".") { type.removeLast() }
        return type
    }

    private func stringDictionary(_ object: JSObject) -> [String: String] {
        var result: [String: String] = [:]
        for (key, value) in object {
            let string = String(describing: value)
            if key.count <= 9, string.utf8.count <= 128 { result[key] = string }
        }
        return result
    }

    private func localAddress() -> String? {
        var pointer: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&pointer) == 0, let first = pointer else { return nil }
        defer { freeifaddrs(pointer) }
        var ipv6: String?
        for item in sequence(first: first, next: { $0.pointee.ifa_next }) {
            let flags = item.pointee.ifa_flags
            guard (flags & UInt32(IFF_UP)) != 0, (flags & UInt32(IFF_LOOPBACK)) == 0,
                  let address = item.pointee.ifa_addr else { continue }
            let family = Int32(address.pointee.sa_family)
            guard family == AF_INET || family == AF_INET6 else { continue }
            var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            let length = family == AF_INET ? socklen_t(MemoryLayout<sockaddr_in>.size) : socklen_t(MemoryLayout<sockaddr_in6>.size)
            if getnameinfo(address, length, &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0 {
                let value = String(cString: host)
                if family == AF_INET { return value }
                if !value.lowercased().hasPrefix("fe80:") { ipv6 = ipv6 ?? value }
            }
        }
        return ipv6
    }
}

final class BoardArenaViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(BoardArenaLanPlugin())
    }
}
