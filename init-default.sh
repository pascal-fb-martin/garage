#! /bin/sh
#
# Default configuration for the garage init script on Raspberry Pi (Debian)
#
# This configuration script must define the following environment variables:
#
#    NODE_JS_HOME  The path to the Node.js installation.
#    GARAGE_USER   The user login used for the sprinkler application.
#    GARAGE_HOME   The path to the sprinkler application.
#

NODE_JS_HOME=/home/pi/opt/node-v0.10.28-linux-arm-pi
GARAGE_USER=pi
GARAGE_HOME=/home/pi/garage

