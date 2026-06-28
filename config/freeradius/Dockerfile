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

EXPOSE 1812/udp 1813/udp

CMD ["freeradius", "-f", "-X"]
