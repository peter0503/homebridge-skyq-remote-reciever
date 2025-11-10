// index.js - Main plugin file
const SkyRemote = require('sky-remote');

let Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-skyq-remote', 'SkyQRemote', SkyQRemoteAccessory);
};

class SkyQRemoteAccessory {
  constructor(log, config) {
    this.log = log;
    this.name = config.name || 'Sky Q Box';
    this.ip = config.ip;
    this.port = config.port || 49160;
    this.config = config;
    
    if (!this.ip) {
      throw new Error('Sky Q box IP address is required');
    }

    // Initialize Sky Remote
    this.remote = new SkyRemote(this.ip, this.port);
    
    // State
    this.isPoweredOn = false;
    this.currentChannel = null;
    this.channelList = [];
    
    // Setup services
    this.setupServices();
    
    // Get channel list on startup
    this.getChannels();
  }

  setupServices() {
    // Information Service
    this.informationService = new Service.AccessoryInformation()
      .setCharacteristic(Characteristic.Manufacturer, 'Sky')
      .setCharacteristic(Characteristic.Model, 'Sky Q Box')
      .setCharacteristic(Characteristic.SerialNumber, this.ip);

    // Television Service
    this.tvService = new Service.Television(this.name, 'television');
    
    this.tvService
      .setCharacteristic(Characteristic.ConfiguredName, this.name)
      .setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

    // Power State
    this.tvService
      .getCharacteristic(Characteristic.Active)
      .on('get', this.getPowerState.bind(this))
      .on('set', this.setPowerState.bind(this));

    // Remote Key
    this.tvService
      .getCharacteristic(Characteristic.RemoteKey)
      .on('set', this.handleRemoteKey.bind(this));

    // Active Identifier (Channel)
    this.tvService
      .getCharacteristic(Characteristic.ActiveIdentifier)
      .on('get', this.getActiveIdentifier.bind(this))
      .on('set', this.setActiveIdentifier.bind(this));

    // Speaker Service (for volume control)
    this.speakerService = new Service.TelevisionSpeaker(this.name + ' Volume', 'speaker');
    
    this.speakerService
      .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
      .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);

    this.speakerService
      .getCharacteristic(Characteristic.VolumeSelector)
      .on('set', this.setVolume.bind(this));

    this.tvService.addLinkedService(this.speakerService);

    // Input Sources (Channels) - will be added when channels are retrieved
    this.inputServices = [];
  }

  async getChannels() {
    try {
      // Austrian Sky Q channel list (Sky Österreich)
      // Limited to most popular channels due to HomeKit's 100 service limit
      const allChannels = [
        // Austrian Public Broadcasting (ORF)
        { id: 1, name: 'ORF eins' },
        { id: 2, name: 'ORF 2' },
        { id: 3, name: 'ORF III' },
        { id: 4, name: 'ORF SPORT +' },
        
        // Main German Channels
        { id: 10, name: 'Das Erste (ARD)' },
        { id: 11, name: 'ZDF' },
        { id: 12, name: 'RTL' },
        { id: 13, name: 'SAT.1' },
        { id: 14, name: 'ProSieben' },
        { id: 15, name: 'VOX' },
        { id: 16, name: 'kabel eins' },
        { id: 17, name: 'RTL II' },
        { id: 18, name: 'Super RTL' },
        { id: 19, name: '3sat' },
        { id: 20, name: 'arte' },
        { id: 21, name: 'ZDFneo' },
        { id: 24, name: 'PULS 4' },
        { id: 25, name: 'ATV' },
        { id: 26, name: 'ServusTV' },
        { id: 28, name: 'PULS 24' },
        
        // News
        { id: 100, name: 'n-tv' },
        { id: 101, name: 'WELT' },
        { id: 104, name: 'euronews' },
        { id: 107, name: 'oe24.TV' },
        
        // Sky Sports Austria
        { id: 200, name: 'Sky Sport Austria 1' },
        { id: 201, name: 'Sky Sport Austria 2' },
        { id: 202, name: 'Sky Sport Austria 3' },
        { id: 203, name: 'Sky Sport Austria 4' },
        { id: 206, name: 'Sky Sport Bundesliga 1' },
        { id: 207, name: 'Sky Sport Bundesliga 2' },
        { id: 210, name: 'Sky Sport F1' },
        { id: 214, name: 'Eurosport 1' },
        { id: 215, name: 'Eurosport 2' },
        { id: 216, name: 'DAZN 1' },
        { id: 217, name: 'DAZN 2' },
        
        // Sky Entertainment
        { id: 300, name: 'Sky Cinema Premieren' },
        { id: 302, name: 'Sky Cinema Best Of' },
        { id: 304, name: 'Sky Cinema Action' },
        { id: 306, name: 'Sky Cinema Family' },
        { id: 307, name: 'Sky Atlantic HD' },
        { id: 308, name: 'Sky One' },
        { id: 309, name: 'Sky Comedy' },
        { id: 310, name: 'Sky Crime' },
        { id: 313, name: 'TNT Serie' },
        { id: 316, name: 'ProSieben MAXX' },
        
        // Kids
        { id: 400, name: 'Nickelodeon' },
        { id: 401, name: 'Disney Channel' },
        { id: 404, name: 'Cartoon Network' },
        { id: 407, name: 'KiKA' },
        
        // Documentaries
        { id: 500, name: 'National Geographic' },
        { id: 501, name: 'Nat Geo Wild' },
        { id: 502, name: 'Discovery Channel' },
        { id: 503, name: 'DMAX' },
        { id: 506, name: 'History' },
        
        // Music
        { id: 600, name: 'MTV' },
        { id: 601, name: 'DELUXE MUSIC' }
      ];

      // Apply maxChannels limit from config (default 50 to stay well under HomeKit's 100 service limit)
      const maxChannels = this.config.maxChannels || 50;
      this.channelList = allChannels.slice(0, maxChannels);
      
      this.createInputSources();
      
      this.log.info(`Loaded ${this.channelList.length} Austrian channels (limited to ${maxChannels})`);
    } catch (error) {
      this.log.error('Error getting channels:', error);
    }
  }

  createInputSources() {
    // Remove existing input services
    this.inputServices.forEach(service => {
      this.tvService.removeLinkedService(service);
    });
    this.inputServices = [];

    // Create input source for each channel
    this.channelList.forEach((channel, index) => {
      const inputService = new Service.InputSource(channel.name, `input-${channel.id}`);
      
      inputService
        .setCharacteristic(Characteristic.Identifier, index)
        .setCharacteristic(Characteristic.ConfiguredName, channel.name)
        .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.TUNER)
        .setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN);

      this.tvService.addLinkedService(inputService);
      this.inputServices.push(inputService);
    });
  }

  getPowerState(callback) {
    // Sky Remote doesn't provide power state, so we return the cached state
    callback(null, this.isPoweredOn ? Characteristic.Active.ACTIVE : Characteristic.Active.INACTIVE);
  }

  async setPowerState(state, callback) {
    try {
      const targetState = state === Characteristic.Active.ACTIVE;
      
      if (targetState !== this.isPoweredOn) {
        await this.remote.press('power');
        this.isPoweredOn = targetState;
        this.log.info(`Power ${targetState ? 'on' : 'off'}`);
      }
      
      callback(null);
    } catch (error) {
      this.log.error('Error setting power state:', error);
      callback(error);
    }
  }

  async handleRemoteKey(key, callback) {
    try {
      const keyMap = {
        [Characteristic.RemoteKey.REWIND]: 'rewind',
        [Characteristic.RemoteKey.FAST_FORWARD]: 'fastforward',
        [Characteristic.RemoteKey.NEXT_TRACK]: 'channelup',
        [Characteristic.RemoteKey.PREVIOUS_TRACK]: 'channeldown',
        [Characteristic.RemoteKey.ARROW_UP]: 'up',
        [Characteristic.RemoteKey.ARROW_DOWN]: 'down',
        [Characteristic.RemoteKey.ARROW_LEFT]: 'left',
        [Characteristic.RemoteKey.ARROW_RIGHT]: 'right',
        [Characteristic.RemoteKey.SELECT]: 'select',
        [Characteristic.RemoteKey.BACK]: 'backup',
        [Characteristic.RemoteKey.EXIT]: 'sky',
        [Characteristic.RemoteKey.PLAY_PAUSE]: 'play',
        [Characteristic.RemoteKey.INFORMATION]: 'i'
      };

      const skyKey = keyMap[key];
      if (skyKey) {
        await this.remote.press(skyKey);
        this.log.info(`Pressed remote key: ${skyKey}`);
      }
      
      callback(null);
    } catch (error) {
      this.log.error('Error handling remote key:', error);
      callback(error);
    }
  }

  getActiveIdentifier(callback) {
    // Return current channel index
    const index = this.channelList.findIndex(ch => ch.id === this.currentChannel);
    callback(null, index >= 0 ? index : 0);
  }

  async setActiveIdentifier(identifier, callback) {
    try {
      const channel = this.channelList[identifier];
      if (channel) {
        // Press backup first to exit current screen/menu
        await this.remote.press('backup');
        await this.delay(300);
        
        // Now change to the channel
        await this.changeChannel(channel.id);
        this.currentChannel = channel.id;
        this.log.info(`Changed to channel: ${channel.name} (${channel.id})`);
      }
      callback(null);
    } catch (error) {
      this.log.error('Error setting channel:', error);
      callback(error);
    }
  }

  async changeChannel(channelNumber) {
    const digits = channelNumber.toString().split('');
    for (const digit of digits) {
      await this.remote.press(digit);
      await this.delay(100);
    }
  }

  async setVolume(direction, callback) {
    try {
      const key = direction === Characteristic.VolumeSelector.INCREMENT ? 'volumeup' : 'volumedown';
      await this.remote.press(key);
      this.log.info(`Volume ${direction === Characteristic.VolumeSelector.INCREMENT ? 'up' : 'down'}`);
      callback(null);
    } catch (error) {
      this.log.error('Error setting volume:', error);
      callback(error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getServices() {
    return [
      this.informationService,
      this.tvService,
      this.speakerService,
      ...this.inputServices
    ];
  }
}