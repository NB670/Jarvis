'use strict'
// Minimal context-isolation preload — no IPC needed, app uses HTTP API routes
const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('isElectron', true)
