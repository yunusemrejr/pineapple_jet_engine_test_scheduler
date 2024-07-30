#!/bin/bash

# Define the path to your Node.js script
NODE_SCRIPT="index.js"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js to run this script."
    exit 1
fi

# Check if the Node.js script file exists
if [ ! -f "$NODE_SCRIPT" ]; then
    echo "Error: '$NODE_SCRIPT' does not exist."
    exit 1
fi

# Run the Node.js app
node "$NODE_SCRIPT"
