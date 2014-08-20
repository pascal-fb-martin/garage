garage
======

Garage door control with web user interface (for private network).

_This software is alpha release. It has not yet been fully tested._

This software is a Node.js application for Raspberry Pi or BeagleBone Black.
It offers a web user interface and no software is required on the client side.

There is no access control at this time: do not make the server accessible
to the open Internet.

The system can control garages with one or more doors: the number of doors and
the properties of each door are defined in a user configuration.

## Hardware

The software uses the board's GPIO to control doors. Each door maps to 3 GPIO
pins:
* The `control` pin is an output that controls a relay or MOSFET transistor.
* The `open` pin is an input that is active when the door is fully open.
* The `closed` pin is an input that is active when the door is fully closed.

## Installation

Installing this software requires knowledge of git, Node.js and some Linux
commands.

The git and Node.js software must be installed beforehand. There is no installer at this time: use git to clone it locally.

The software depends on the following Node.js module, which much be installed
using npm:
* access package (versions 3 or 4). The garage software was tested with access
version 4.
* graceful-fs.
* server-static.
* onoff.

Create directory `/var/lib/garage` (the user account used to run the garage
software must have read/write/execute access).

Copy init-debian.sh as /etc/init.d/garage (must have executable permissions)
and activate using the Debian's `insserv` command.

## Configuration

The software is configured through a `config.json` file in dirctory
`/var/lib/garage`. Here is a example of a configuration with two garage doors:

```
{
   "webport": 8080,
   "doors": {
      "main": {
        "name": "Main Garage Door",
        "control": {
           "pin": "gpio1",
           "on": "HIGH"
        },
        "open": {
           "pin": "gpio2",
           "on": "LOW"
        },
        "closed": {
           "pin": "gpio3",
           "on": "LOW"
        }
      }
      "small": {
        "name": "Small Garage Door",
        "control": {
           "pin": "gpio4",
           "on": "HIGH"
        },
        "open": {
           "pin": "gpio5",
           "on": "LOW"
        },
        "closed": {
           "pin": "gpio6",
           "on": "LOW"
        }
      }
   }
}
```

The `webport` item defines the TCP port number used by the web server.

The `doors` item is a JavaScript object, in which each element is a door's
description.

A door description must contain three pin descriptions: `control`, `open`
and `closed`. Each pin description is a JavaScript object with two elements:
`pin` (the name of the GPIO pin, as defined on your system) and `on` (the
value of the pin when active: `HIGH`, i.e. 5V, or `LOW`, i.e. 0V).

