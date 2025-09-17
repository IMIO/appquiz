.PHONY: help			# List phony targets
help:
	@cat "Makefile" | grep '^.PHONY:' | sed -e "s/^.PHONY:/- make/"

.PHONY: watch			# Watch docker image
watch:
	docker compose up --build --watch
