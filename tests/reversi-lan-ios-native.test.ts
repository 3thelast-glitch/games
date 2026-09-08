import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const swift = readFileSync('native/lan/ios/BoardArenaLanPlugin.swift', 'utf8');
const mobileScript = readFileSync('scripts/mobile.mjs', 'utf8');

test('iOS Reversi LAN plugin exposes the same bounded native transport surface as Android', () => {
  for (const method of [
    'startHost',
    'updateHost',
    'stopHost',
    'startDiscovery',
    'stopDiscovery',
    'connect',
    'disconnect',
    'send',
  ]) {
    assert.match(swift, new RegExp(`CAPPluginMethod\\(name: "${method}"`));
    assert.match(swift, new RegExp(`@objc func ${method}\\(`));
  }
  assert.match(swift, /public let jsName = "BoardArenaLan"/);
  assert.match(swift, /NWListener/);
  assert.match(swift, /bonjourWithTXTRecord/);
  assert.match(swift, /maxMessageBytes = 16_384/);
  assert.match(swift, /expectedRevision|receiveNext/);
  assert.match(swift, /registerPluginInstance\(BoardArenaLanPlugin\(\)\)/);
});

test('iOS native generation wires Local Network privacy, Bonjour and the custom Capacitor bridge', () => {
  assert.match(mobileScript, /NSLocalNetworkUsageDescription/);
  assert.match(mobileScript, /NSBonjourServices/);
  assert.match(mobileScript, /_boardarena\._tcp/);
  assert.match(mobileScript, /native\/lan\/ios\/BoardArenaLanPlugin\.swift/);
  assert.match(mobileScript, /customClass="BoardArenaViewController" customModule="App" customModuleProvider="target"/);
  assert.match(mobileScript, /Capacitor storyboard template changed: review LAN plugin registration/);
});
