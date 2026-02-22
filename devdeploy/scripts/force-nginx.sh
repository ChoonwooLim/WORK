#!/bin/bash
for file in /home/stevenlim/WORK/infrastructure/nginx/conf.d/*.conf; do
    if grep -q "server_name" "$file" && ! grep -q "127.0.0.1" "$file"; then
        sed -i 's/server_name \(.*\)\.localhost \(.*\)\.twinverse.org;/server_name \1.localhost \1.twinverse.org localhost 127.0.0.1;/' "$file"
    fi
done
