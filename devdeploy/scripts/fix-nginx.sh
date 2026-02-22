#!/bin/bash
for file in /home/stevenlim/WORK/infrastructure/nginx/conf.d/*.conf; do
    if grep -q "server_name" "$file"; then
        sed -i 's/server_name \(.*\)\.localhost;/server_name \1.localhost \1.twinverse.org;/' "$file"
    fi
done
