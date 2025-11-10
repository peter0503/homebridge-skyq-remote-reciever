# Homebridge Sky Q Remote

Control your Sky Q box through Apple Home using Homebridge.

## Installation

1. Install Homebridge: `npm install -g homebridge`
2. Install this plugin: `npm install -g homebridge-skyq-remote-reciever`
3. Install sky-remote dependency: `npm install -g sky-remote`

## Configuration

Add to your Homebridge config.json:

```json
{
  "accessories": [
    {
      "accessory": "SkyQRemote",
      "name": "Sky Q Box",
      "ip": "192.168.1.100",
      "port": 49160
    }
  ]
}
```

## Features

- Power on/off
- Remote control (arrows, select, back, etc.)
- Channel selection
- Volume control
- Channel list with popular UK channels

## Finding Your Sky Q IP Address

1. Go to Settings on your Sky Q box
2. Navigate to Setup > Network
3. Note the IP address shown

## Usage

Once configured, the Sky Q box will appear in Apple Home as a TV accessory. You can:
- Turn it on/off
- Use the remote control in Control Center
- Change channels
- Control volume
- Use Siri commands

## Troubleshooting

- Ensure your Sky Q box is on the same network as Homebridge
- Verify the IP address is correct
- Check that port 49160 is accessible (default Sky Q port)
*/