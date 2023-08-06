"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const nostr_tools_1 = require("nostr-tools");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ndk_1 = require("@nostr-dev-kit/ndk");
const ndk_2 = __importDefault(require("@nostr-dev-kit/ndk"));
const loadJSON = (filename) => {
    const rawdata = fs_1.default.readFileSync(path_1.default.join(filename), 'utf8');
    return JSON.parse(rawdata);
};
const loadNPUB = (filename) => {
    // console.log(`Loading ${filename}`);
    const rawdata = fs_1.default.readFileSync(path_1.default.join(filename), 'utf8');
    return JSON.parse(rawdata);
};
const createNote = (note, pubKey, ndk, signer) => __awaiter(void 0, void 0, void 0, function* () {
    let ndkEvent = new ndk_1.NDKEvent(ndk);
    yield ndk.connect().then(() => {
        ndkEvent.kind = 30041;
        ndkEvent.content = note.text;
        ndkEvent.pubkey = (0, nostr_tools_1.getPublicKey)(pubKey);
        ndkEvent.tags = [
            ['title', note.title],
        ];
    }).catch((err) => { console.log(err); });
    yield ndkEvent.sign(signer);
    yield ndk.publish(ndkEvent);
    return ndkEvent;
});
const createArticleHeader = (note, filename, pubKey, eventList, ndk, signer) => __awaiter(void 0, void 0, void 0, function* () {
    let ndkEvent = new ndk_1.NDKEvent(ndk);
    const corpusID = filename.split('_')[0];
    yield ndk.connect().then(() => {
        ndkEvent.kind = 30040;
        ndkEvent.content = `{"corpusId": "${corpusID}", "title": "${note.title}","fieldsOfStudy": ${note.fieldsOfStudy}}`;
        ndkEvent.pubkey = (0, nostr_tools_1.getPublicKey)(pubKey);
        ndkEvent.tags = [];
        for (let i = 0; i < eventList.length; i++) {
            ndkEvent.tags.push(['e', eventList[i].id, 'wss://relay.damus.io']);
        }
    }).catch((err) => { console.log(err); });
    yield ndkEvent.sign(signer);
    yield ndk.publish(ndkEvent);
    return ndkEvent;
});
const main = () => __awaiter(void 0, void 0, void 0, function* () {
    const jsonFolder = fs_1.default.readdirSync('./jsonFiles');
    const jsonFiles = jsonFolder.filter((file) => file.endsWith('.json'));
    console.log(`Found ${jsonFiles.length} files`);
    // user.json looks like this: {"npub": <npub>, "nsec": <nsec>}
    const userKeys = loadNPUB('./user.json');
    const nsec = userKeys.nsec;
    const privateKey = nostr_tools_1.nip19.decode(nsec);
    const pubKey = privateKey.data;
    const signer = new ndk_1.NDKPrivateKeySigner(privateKey.data);
    const ndk = new ndk_2.default({
        explicitRelayUrls: ['wss://relay.damus.io'],
        signer: signer
    });
    let eventList = [];
    const forward_files = jsonFiles.filter((file) => file.includes('993410')).sort((a, b) => Number(a.split('.')[0]) - Number(b.split('.')[0]));
    for (let i = 0; i < forward_files.length; i++) {
        console.log(`Processing ${forward_files[i]}`);
        const text = loadJSON(`./jsonFiles/${forward_files[i]}`);
        // JSON looks like this:
        // filename is <corpusID>_{start_token}_{end_token}.json
        // corpusID is attained from semantic scholar (see )
        // {"text": <text>, "title": <title>,
        // "subtitle": <subtitle>, "fieldsOfStudy": [<field1>, <field2>, ...]}
        const event = createNote(text, pubKey, ndk, signer);
        eventList.push(yield event);
        console.log(`List is now ${eventList.length} long`);
    }
    const header = createArticleHeader(loadJSON(`./jsonFiles/${forward_files[0]}`), forward_files[0], pubKey, eventList, ndk, signer);
    yield header;
    // }
    // ndk.removeAllListeners();
    // await header;
});
main();
