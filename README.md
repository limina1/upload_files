

## upload.ts
- first add individual json files to notes folder like `{title_name}_0_1.json`, `{title_name}_1_2.json` etc
- add credentials to user.json
- add relay(s) you care to publish to in upload.ts
- change variable articleName to `{title_name}`
``` sh
npm install
npx esrun src/upload.ts
```

## read.js
- counts all events of kind: `{kind}` on the relay of interest

``` sh
node read.js
```

`
## delete.ts
- fetches all kinds 30040 and 30041 from a relay of a given user and deletes them.

``` sh
npx esrun src/delete.ts
```




