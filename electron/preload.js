'use strict'
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('isElectron', true)
contextBridge.exposeInMainWorld('voiceAPI', {
  onStateChange: (cb) => {
    ipcRenderer.on('voice:state', (_event, data) => cb(data))
  },
  close: () => {
    ipcRenderer.send('voice:close')
  },
})
