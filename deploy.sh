#!/bin/bash
HOST=$FTP_HOST
USER=$FTP_USER
PASS=$FTP_PASS
TARGET=$FTP_TARGET

lftp -e "set ssl:verify-certificate no; open -u $USER,$PASS $HOST; mirror -R -e ./ $TARGET; quit"
