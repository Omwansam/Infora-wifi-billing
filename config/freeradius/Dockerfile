FROM freeradius/freeradius-server:latest

# SQL module + site config for Infora billing
COPY mods-available/sql /etc/freeradius/3.0/mods-available/sql
COPY mods-config/sql/main/postgresql/queries.conf \
     /etc/freeradius/3.0/mods-config/sql/main/postgresql/queries.conf
COPY sites-available/default /etc/freeradius/3.0/sites-available/default
COPY clients.conf /etc/freeradius/3.0/clients.conf

RUN mkdir -p /etc/freeradius/3.0/mods-enabled /etc/freeradius/3.0/sites-enabled \
    && ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql \
    && ln -sf /etc/freeradius/3.0/sites-available/default /etc/freeradius/3.0/sites-enabled/default

# iproute2 for the tunnel return route (10.250.0.0/24 via infora_wireguard)
RUN apt-get update && apt-get install -y --no-install-recommends iproute2 \
    && rm -rf /var/lib/apt/lists/*

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 1812/udp 1813/udp

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["freeradius", "-f", "-X"]
