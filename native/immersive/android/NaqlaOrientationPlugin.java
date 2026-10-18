package com.boardarena.app;

import android.content.pm.ActivityInfo;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Only the active arcade game requests landscape. The NAQLA library remains portrait. */
@CapacitorPlugin(name = "NaqlaOrientation")
public class NaqlaOrientationPlugin extends Plugin {
    private int previous = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;

    @PluginMethod
    public void landscape(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                previous = getActivity().getRequestedOrientation();
                getActivity().setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                call.resolve();
            } catch (Exception error) { call.reject("landscape-failed", error); }
        });
    }
    @PluginMethod
    public void restore(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().setRequestedOrientation(previous);
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                call.resolve();
            } catch (Exception error) { call.reject("restore-failed", error); }
        });
    }
}
