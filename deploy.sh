#!/bin/bash

# Get the current date and time
DATE=$(date +"%Y-%m-%d %H:%M:%S")

# Add all changes
git add .

# Commit with timestamp
git commit -m "Auto commit: $DATE"

# Push to main branch
git push origin main

echo "Changes pushed to GitHub successfully!" 