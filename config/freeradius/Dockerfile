# Pinned on purpose. The `latest` tag moved from FreeRADIUS 3.0.x to 3.2.x, and
# with it the config root: 3.0 kept everything under /etc/freeradius/3.0, 3.2
# uses /etc/freeradius directly. Every COPY below used to target the 3.0 path,
# so on a rebuild they silently created a directory the server never reads —
# no SQL module, no clients.conf, no site config, and every subscriber rejected.
# Bump this deliberately and re-check the paths when you do.
FROM freeradius/freeradius-server:3.2.10

# /etc/raddb is the version-independent symlink to the active config root
# (-> /etc/freeradius/3.0 on 3.0.x, -> /etc/freeradius on 3.2.x). Always use it.
ARG RADDB=/etc/raddb

# SQL module + site config for Infora billing
COPY mods-available/sql ${RADDB}/mods-available/sql
COPY mods-config/sql/main/postgresql/queries.conf \
     ${RADDB}/mods-config/sql/main/postgresql/queries.conf
COPY sites-available/default ${RADDB}/sites-available/default
COPY clients.conf ${RADDB}/clients.conf

# sql is not enabled in the stock image; default and inner-tunnel already are.
# The greps are a build-time guard: fail here rather than ship an image whose
# config lands somewhere the server never reads (exactly what the 3.0 path did).
RUN ln -sf ${RADDB}/mods-available/sql ${RADDB}/mods-enabled/sql \
    && ln -sf ${RADDB}/sites-available/default ${RADDB}/sites-enabled/default \
    && test -L ${RADDB}/mods-enabled/sql \
    && grep -q rlm_sql_postgresql ${RADDB}/mods-enabled/sql \
    && grep -qi infora ${RADDB}/sites-enabled/default \
    && grep -q sql_user_name ${RADDB}/mods-enabled/sql

# iproute2 for the tunnel return route (10.250.0.0/24 via infora_wireguard)
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 \
    && rm -rf /var/lib/apt/lists/*

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 1812/udp 1813/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["freeradius", "-f", "-X"]
