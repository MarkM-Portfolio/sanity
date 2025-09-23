FROM connections-docker.artifactory.cwp.pnp-hcl.com/base/node:14-alpine

ENV APP_DIR=/home/ibm/app/

COPY . $APP_DIR

RUN apk add --no-cache openssl \
  && chown -R ${SERVICE_USER}.${SERVICE_USER} $APP_DIR \
  && chmod +x ${APP_DIR}/entrypoint.sh \
  && rm -rf /usr/bin/nc

USER $SERVICE_USER

WORKDIR $APP_DIR

VOLUME ["$APP_DIR/var/elasticsearch", "$APP_DIR/var/solr", "$APP_DIR/var/config", "$APP_DIR/var/redis", "$APP_DIR/var/mongo", "$APP_DIR/var/newrelic" ]

EXPOSE 3000

ENTRYPOINT ["/home/ibm/app/entrypoint.sh"]

CMD [ "npm", "start" ]
