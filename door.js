//  Garage - a web server to control garage doors.
//
//  Copyright (C) 2014  Pascal Martin.
//
//  This program is free software; you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation; either version 2 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along
//  with this program; if not, write to the Free Software Foundation, Inc.,
//  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
//
// --------------------------------------------------------------------------
//
// NAME
//
//   door - a module to hide the interface to GPIO pins for a door.
//
// SYNOPSYS
//
//   This module hides the interface to system-specific GPIO libraries.
//
//   This module allows porting the garage software to different
//   hardware interfaces. Only one hardware interface is supported at
//   a given time: you must have installed the right driver.
//
//   This specific implementation supports the "onoff" GPIO library.
//
//   This module depends on 'onoff' because that is one gpio interface
//   that is available on BeagleBone and Raspberry Pi (and probably others,
//   since it only relies on /sys/class/gpio).
//
//   This module do some tricks to workaround a Raspbian issue: access to
//   the gpio files is only granted after a short while, in the background.
//   The application needs to try again if it failed.
//
// DESCRIPTION
//
//   var Door = require('./door').Door;
//
//   var door = new Door (name, config, options);
//
//      Instanciate a new door, given the user-defined configuration and
//      command line options.
//
//      The config parameter must be a JavaScript object with the following
//      attributes:
//         name          The human readable identifier of the door.
//         control.pin   The name of the pin that controls that door.
//         control.on    The active value for the control (default: 1).
//         control.pulse The duration of the control pulse (default: 500).
//         open.pin      The name of the pin that reports the "open" state.
//         open.on       The active value for the "open" state (default: 0).
//         closed.pin    The name of the pin that reports the "closed" state.
//         closed.on     The active value for the "closed" state (default: 0).
//
//   door.status ();
//
//      Return the current status of the door: "Closed", "Open", "Closing..",
//      "Opening..", "Moving..", "Unknown".
//
//      The "Moving.." and "Unknown" statuses are used when the actual state
//      of the door cannot be derived from the input and history of controls.
//
//   door.pulse ();
//
//      Trigger the control pulse to move the door.
//
//   door.reset ();
//
//      Force the control trigger off. This is used in case the program exits,
//      to avoid leaving the control active, which would block the door.
//
// --------------------------------------------------------------------------

function debugLog (text) {}

function debugLogEnabled (text) {
   console.log ('[DEBUG] door: '+text);
}

function errorLog (text) {
   console.error ('[ERROR] door: '+text);
}

function cautionLog (text) {
   console.error ('[CAUTION] door: '+text);
}

try {
   var gpio = require('onoff').Gpio;
}
catch (err) {
   errorLog ('cannot access module onoff');
   var gpio = null;
}


// Raspbian issue: access to the gpio files is only granted
// after a short while, in the background. Need to try again until succesful.

function retry(item) {
   cautionLog ('Setting up pin '+item.pin+' failed, scheduling retry in 0.2 second');

   setTimeout (function() {
      cautionLog ('Retrying pin '+item.pin);
      try {
         item.gpio = new gpio(item.pin, 'out');
         item.ready = true; // No error was raised this time.
         if (item.dir == 'out') {
            item.gpio.writeSync(item.off);
         }
      }
      catch (err) {
         retry(item);
      }
   }, 200);
}

function configurePin (name, io, dir) {

   var item = new Object();

   item.name = name;
   item.pin = io.pin;
   item.dir = dir;
   debugLog ('   '+name+' is pin '+item.pin+' ('+item.dir+')');
   if (dir == 'out') {
      item.on = 1;
      item.off = 0;
   } else {
      item.on = 0;
      item.off = 1;
      item.control = false;
   }
   if (io.on != undefined) {
      if (io.on == 'HIGH') {
         item.on = 1;
         item.off = 0;
      } else if (io.on == 'LOW') {
         item.on = 0;
         item.off = 1;
      }
   }
   item.status = false;
   item.value  = item.off;

   if (gpio) {
      // Raspbian bug: access to the gpio files is only granted
      // after a short while, in the background.
      // Need to try again if it failed.
      item.ready = false;
      try {
         item.gpio = new gpio(item.pin, item.dir);
         item.ready = true; // No error was raised.
         if (item.dir == 'out') {
            item.gpio.writeSync(item.off);
         }
      }
      catch (err) {
         retry(item);
      }
   } else {
      item.ready = true;
   }
   return item;
}

function Door (config, options) {

   this.debug = false;
   if (options && options.debug) {
      this.debug = true;
      debugLog = debugLogEnabled;
      debugLog ('debug mode enabled');
   }

   if (! gpio) {
      if (this.debug) debugLog ('using debug GPIO traces');
   }

   debugLog ('Initializing door '+config.name);

   this.name    = config.name;
   this.control = configurePin ('control', config.control, 'out');
   if (config.open) {
      this.open = configurePin ('open', config.open, 'in');
   }
   if (config.closed) {
      this.closed = configurePin ('closed', config.closed, 'in');
   }

   if (config.control.pulse) {
      this.control.pulse = config.control.pulse;
   } else {
      this.control.pulse = 500;
   }

   this.control.pending = false;
   this.control.deadline = 0;
}

Door.prototype.pulse = function () {

   if (this.open) {
      this.open.control = this.open.status;
   }
   if (this.closed) {
      this.closed.control = this.closed.status;
   }
   this.control.pending = true;
   this.control.deadline = Date.now() + 3000;

   if (this.debug) {
      debugLog ('GPIO '+this.control.pin+' pulsed ('+this.control.pulse+'ms)');
   }
   if (this.control.gpio) {
      var control = this.control;
      control.gpio.writeSync(control.on);
      setTimeout (function() {
         control.gpio.writeSync(control.off);
      }, control.pulse);
   }
}

Door.prototype.reset = function () {

   this.control.pending = false;

   if (this.debug) {
      debugLog ('GPIO '+this.control.pin+' reset');
   }
   if (this.control.gpio) {
      this.control.gpio.writeSync(control.off);
   }
}

function debounce(input) {

   if (input.gpio) {
      var value = input.gpio.readSync();

      // Handle rebounce by requiring two identical consecutive values.
      if (value != input.value) {
         debugLog ('value of '+input.name+' changed from '+input.value+' to '+value);
         if (input.latest == value) {
            var old = input.status;
            input.value = value;
            input.status = (input.value == input.on);
            debugLog ('status of '+input.name+' changed from '+old+' to '+input.status);
         }
      }
      input.latest = value;
   }
}

function completed (input) {
   if (input) {
      if (input.status && (!input.control)) {
         return true;
      }
   }
   return false;
}

function moved (input) {
   if (input) {
      if (input.status != input.control) {
         return true;
      }
   }
   return false;
}

Door.prototype.refresh = function () {

   if (this.open) {
      debounce (this.open);
   }
   if (this.closed) {
      debounce (this.closed);
   }

   // Detect when a pending control has been completed.
   // If we have only one input, we are happy enough if the input indicates
   // that the door moved (which may not guarantee that the move is over).
   // If we have no input, just wait for a few seconds.
   //
   if (this.control.pending) {
      if (this.closed && this.open) {
         if (completed(this.open) || completed(this.closed)) {
            this.control.pending = false;
         }
      } else if (this.open) {
         if (moved(this.open)) {
            this.control.pending = false;
         }
      } else if (this.closed) {
         if (moved(this.closed)) {
            this.control.pending = false;
         }
      } else {
         if (this.control.deadline < Date.now()) {
            this.control.pending = false;
         }
      }
   }
}

Door.prototype.status = function () {

   if (this.control.pending) {
      if (this.closed && this.open) {
         if (this.closed.control) {
            return "opening..";
         }
         if (this.open.control) {
            return "closing..";
         }
         return "moving..";
      }
      if (this.closed) {
         if (this.closed.control) {
            return "opening..";
         } else {
            return "closing..";
         }
      }
      if (this.open) {
         if (this.open.control) {
            return "closing..";
         } else {
            return "opening..";
         }
      }
      return "moving..";

   } else {
      if (this.closed && this.open) {
         if (this.open.status) {
            status = "open";
         } else if (this.closed.status) {
            status = "closed";
         }
      }
      if (this.open) {
         if (this.open.status) {
            return "open";
         }
      }
      if (this.closed) {
         if (this.closed.status) {
            return "closed";
         }
      }
   }

   return "unknown";
}

exports.Door = Door;

