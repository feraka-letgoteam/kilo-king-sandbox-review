# Kilo King checkpoint

Two archives, one folder. `source.zip` is the code. `assets.zip` is the current public artwork. The preview **Source** button saves one combined archive, `kilo-king-source.zip`, which already contains both.

## Extract

Split archives:

```sh
mkdir kilo-king
cd kilo-king
unzip /path/to/source.zip
unzip /path/to/assets.zip
```

Single archive from the preview Source button:

```sh
unzip kilo-king-source.zip -d kilo-king
cd kilo-king
```

## Review

Node 22 or newer. Uses the lockfile. Does not migrate a database and does not deploy.

```sh
npm ci
npm run dev:review
```

Open http://127.0.0.1:8082/review.html?review

That is the local review table with saved scenes. Stop it with Ctrl+C. Port 8082 is only this review server.
