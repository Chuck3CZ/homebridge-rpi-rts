// const RpiGpioRts = require('./RpiGpioRts');

let Service, Characteristic;

module.exports = homebridge => {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory('homebridge-rpi-somfy-roller-shutter', 'Somfy RTS Roller Shutter', SomfyRtsRollerShutterAccessory);
};

/**
 * Class simulating a Somfy RTS Remote Accessory for Homebridge
 * with 4 'stateless' switches: Up, Down, My, Prog
 *
 * @class SomfyRtsRollerShutterAccessory
 */
class SomfyRtsRollerShutterAccessory {

	/**
	 * Constructor of the class SomfyRtsRollerShutterAccessory
	 *
	 * @constructor
	 * @param {Object} log - The Homebridge log
	 * @param {Object} config - The Homebridge config data filtered for this item
	*/
	constructor(log, config) {
		this.log = log;
		if (!config || !config.name || !config.id) {
			throw new Error(`Invalid or missing configuration.`);
		}
		this.config = config;
		// this.emitter = new RpiGpioRts(log, config);
		
		// Delay to reset the switch after being pressed
		this.delay = 500;
		
		// this.buttons = ['Up', 'Down', 'My'];
		// if (this.config.prog === true) this.buttons.push('Prog');

		this.currentPosition = 100;
		this.positionState = Characteristic.PositionState.STOPPED;
		this.targetPosition = 100;

		setInterval(() => {
			if (this.currentPosition > this.targetPosition) {
				this.log.info(`setInterval dec ${this.currentPosition} ${this.targetPosition} `);
				this.currentPosition--;
				this.positionState = Characteristic.PositionState.DECREASING;

				this.windowCoveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.currentPosition);
				this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(this.currentPosition === this.targetPosition ? Characteristic.PositionState.STOPPED: Characteristic.PositionState.DECREASING);
			} else if (this.currentPosition < this.targetPosition) {
				this.log.info(`setInterval inc ${this.currentPosition} ${this.targetPosition} `);
				this.currentPosition++;
				this.positionState = Characteristic.PositionState.INCREASING;

				this.windowCoveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.currentPosition);
				if (this.currentPosition === this.targetPosition) this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.STOPPED);
				this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(this.currentPosition === this.targetPosition ? Characteristic.PositionState.STOPPED: Characteristic.PositionState.INCREASING);
			}
		}, 100);

		// // Create an object such as {'Up': false, 'Down': false, ...}
		// this.states = this.buttons.reduce((acc, cur) => {
		// 	acc[cur] = false;
		// 	return acc;
		// }, {});
		
		// this.switchServices = {};
		
		// this.buttons.forEach(button => {
		
		// 	this.switchServices[button] = new Service.Switch(`${this.config.name} ${button}`, button);
			
		// 	this.switchServices[button]
		// 		.getCharacteristic(Characteristic.On)
		// 		.on('get', this.getOn.bind(this, button))
		// 		.on('set', this.setOn.bind(this, button));
		// });
		
		this.windowCoveringService = new Service.WindowCovering(this.config.name);

		this.windowCoveringService
			.getCharacteristic(Characteristic.CurrentPosition)
			.on('get', this.getCurrentPosition.bind(this));

		this.windowCoveringService
			.getCharacteristic(Characteristic.PositionState)
			.on('get', this.getPositionState.bind(this));


		this.windowCoveringService
			.getCharacteristic(Characteristic.TargetPosition)
			.on('get', this.getTargetPosition.bind(this))
			.on('set', this.setTargetPosition.bind(this));

		this.log.info(`Initialized accessory`);
	}

	/**
	 * Getter for the 'getCurrentPosition' characteristic of the 'WindowCovering' service
	 *
	 * @method getCurrentPosition
	 * @param {Function} callback - A callback function from Homebridge
	*/
	getCurrentPosition(callback) {
		this.log.info(`Function getCurrentPosition called and return ${this.currentPosition}`);
		callback(null, this.currentPosition);
	}

	/**
	 * Getter for the 'getPositionState' characteristic of the 'WindowCovering' service
	 *
	 * @method getPositionState
	 * @param {Function} callback - A callback function from Homebridge
	*/
	getPositionState(callback) {
		this.log.info(`Function getPositionState called and return ${this.positionState}`);
		callback(null, this.positionState);
	}

	/**
	 * Getter for the 'getTargetPosition' characteristic of the 'WindowCovering' service
	 *
	 * @method getTargetPosition
	 * @param {Function} callback - A callback function from Homebridge
	*/
	getTargetPosition(callback) {
		this.log.info(`Function getTargetPosition called and return ${this.targetPosition}`);
		callback(null, this.targetPosition);
	}

	/**
	 * Setter for the 'setTargetPosition' characteristic of the 'WindowCovering' service
	 *
	 * @method setTargetPosition
	 * @param {Object} value - The value for the characteristic
	 * @param {Function} callback - A callback function from Homebridge
	 * @param {String} button - 'Up', 'Down', 'My', 'Prog'
	*/
	setTargetPosition(value, callback) {
		this.log.info(`Function setTargetPosition called with value ${value}`);
		this.targetPosition = value;
		// if (value === true) {
		// 	this.emitter.sendCommand(button);
		// 	this.resetSwitchWithTimeout(button);
		// }
		callback(null);
	}



	/**
	 * Reset the switch to false to simulate a stateless behavior
	 *
	 * @method resetSwitchWithTimeout
	 * @param {String} button - 'Up', 'Down', 'My', 'Prog'
	*/
	// resetSwitchWithTimeout(button) {
	// 	this.log.info(`Function resetSwitchWithTimeout called for button ${button}`);
	// 	setTimeout(function() {
	// 		this.switchServices[button].setCharacteristic(Characteristic.On, false);
	// 	}.bind(this), this.delay);
	// }
	
	/**
	 * Mandatory method for Homebridge
	 * Return a list of services provided by this accessory
	 *
	 * @method getServices
	 * @return {Array} - An array containing the services
	*/
	getServices() {
		this.log.info(`Function getServices called`);
		return [this.windowCoveringService];
	}
}
