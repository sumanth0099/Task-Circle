#!/bin/sh
set -e
: "${PORT:=80}"
envsubst '$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
nginx -g 'daemon off;'
