FROM bitnami/suitecrm:latest

USER root
RUN mkdir -p /opt/kosh
COPY bootstrap.sh /opt/kosh/bootstrap.sh
RUN chmod +x /opt/kosh/bootstrap.sh
USER 1001

ENTRYPOINT ["/opt/kosh/bootstrap.sh"]
