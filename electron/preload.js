'use strict'
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('isElectron', true)
let _stateListener = null
contextBridge.exposeInMainWorld('voiceAPI', {
  onStateChange: (cb) => {
    if (_stateListener) ipcRenderer.removeListener('voice:state', _stateListener)
    _stateListener = (_event, data) => cb(data)
    ipcRenderer.on('voice:state', _stateListener)
  },
  close: () => {
    ipcRenderer.send('voice:close')
  },
})
