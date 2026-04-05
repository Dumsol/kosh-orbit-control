FROM bitnamilegacy/suitecrm:8.8.1-debian-12-r3

USER root
RUN mkdir -p /opt/kosh
COPY bootstrap.sh /opt/kosh/bootstrap.sh
RUN chmod +x /opt/kosh/bootstrap.sh
USER 1001

ENTRYPOINT ["/opt/kosh/bootstrap.sh"]
