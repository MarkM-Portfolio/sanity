#!/bin/sh

echo "Test started ..."
has_errors=0
echo "1: Hitting http://sanity:3000/api"
#wget -T 5 http://sanity:3000/api || has_errors=1
curl http://sanity:3000/api || has_errors=1

echo "====================================="
echo "Test finished, has_errors=$has_errors"
echo "====================================="
exit $has_errors
