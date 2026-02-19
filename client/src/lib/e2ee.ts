import {
    KeyHelper,
    SessionBuilder,
    SessionCipher,
    SignalProtocolAddress,
    SignalProtocolStore,
    // Types (aliased to any or specific types for store if needed)
    IdentityKeyPair
} from '@privacyresearch/libsignal-protocol-typescript';

// Define types locally if needed to silence TS about missing generics
type SessionRecord = string;
type PreKeyRecord = any;
type SignedPreKeyRecord = any;

// Simple Persistent Store for Signal using LocalStorage
class PersistentSignalProtocolStore implements SignalProtocolStore {
    private identityKeyPair: IdentityKeyPair | undefined;
    private localRegistrationId: number | undefined;
    private sessions: { [key: string]: SessionRecord } = {};
    private preKeys: { [key: string]: PreKeyRecord } = {};
    private signedPreKeys: { [key: string]: SignedPreKeyRecord } = {};
    private remoteIdentities: { [key: string]: ArrayBuffer } = {}; // Remote Public Keys

    constructor(private readonly prefix: string = 'signal_store_') {
        this.load();
    }

    private load() {
        const data = localStorage.getItem(this.prefix + 'data');
        if (data) {
            try {
                // Debug Log for Load
                // console.log('[E2EE Store] Loading raw:', data.substring(0, 50) + '...'); 
                const parsed = JSON.parse(data, this.reviver);

                // Debug check
                if (parsed.identityKeyPair && parsed.identityKeyPair.byteLength) {
                    console.error('[E2EE Store] CRITICAL: Loaded identityKeyPair is an ArrayBuffer!', parsed.identityKeyPair);
                }

                this.identityKeyPair = parsed.identityKeyPair;
                this.localRegistrationId = parsed.localRegistrationId;
                this.sessions = parsed.sessions || {};
                this.preKeys = parsed.preKeys || {};
                this.signedPreKeys = parsed.signedPreKeys || {};
            } catch (e) {
                console.error('[E2EE Store] Load failed:', e);
            }
        }
    }

    private save() {
        const data = {
            identityKeyPair: this.identityKeyPair,
            localRegistrationId: this.localRegistrationId,
            remoteIdentities: this.remoteIdentities,
            sessions: this.sessions,
            preKeys: this.preKeys,
            signedPreKeys: this.signedPreKeys
        };
        localStorage.setItem(this.prefix + 'data', JSON.stringify(data, this.replacer));
    }

    // Helper to handle ArrayBuffers in JSON
    private replacer(key: string, value: any) {
        if (value instanceof ArrayBuffer) {
            return {
                type: 'ArrayBuffer',
                data: Array.from(new Uint8Array(value))
            };
        }
        // Explicitly handle IdentityKeyPair-like objects if they aren't auto-handled
        if (value && value.pubKey instanceof ArrayBuffer && value.privKey instanceof ArrayBuffer) {
            return {
                type: 'IdentityKeyPair',
                pubKey: { type: 'ArrayBuffer', data: Array.from(new Uint8Array(value.pubKey)) },
                privKey: { type: 'ArrayBuffer', data: Array.from(new Uint8Array(value.privKey)) }
            };
        }
        return value;
    }

    private reviver(key: string, value: any) {
        if (value && value.type === 'ArrayBuffer' && Array.isArray(value.data)) {
            return new Uint8Array(value.data).buffer;
        }
        if (value && value.type === 'IdentityKeyPair') {
            return {
                pubKey: value.pubKey,
                privKey: value.privKey
            };
        }
        return value;
    }

    async getIdentityKeyPair(): Promise<IdentityKeyPair | undefined> {
        const kp = this.identityKeyPair;
        if (!kp || !kp.pubKey || !kp.privKey) {
            return undefined;
        }

        // rigorous validation
        if (!(kp.pubKey instanceof ArrayBuffer)) {
            console.warn('[E2EE] public key is not ArrayBuffer, attempting fix...');
            if (kp.pubKey instanceof Uint8Array) {
                kp.pubKey = (kp.pubKey as Uint8Array).buffer;
            } else {
                // Corrupted
                console.error('[E2EE] Identity Public Key corrupted:', kp.pubKey);
                return undefined;
            }
        }
        if (!(kp.privKey instanceof ArrayBuffer)) {
            console.warn('[E2EE] private key is not ArrayBuffer, attempting fix...');
            if (kp.privKey instanceof Uint8Array) {
                kp.privKey = (kp.privKey as Uint8Array).buffer;
            } else {
                console.error('[E2EE] Identity Private Key corrupted:', kp.privKey);
                return undefined;
            }
        }

        return this.identityKeyPair;
    }
    async getLocalRegistrationId(): Promise<number | undefined> {
        return this.localRegistrationId;
    }
    async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
        if (identityKey instanceof ArrayBuffer) {
            this.remoteIdentities[identifier] = identityKey;
            this.save();
        } else {
            console.error('[E2EE] saveIdentity called with non-ArrayBuffer:', identityKey);
        }
        return true;
    }

    async isTrustedIdentity(identifier: string, identityKey: ArrayBuffer, direction: number): Promise<boolean> {
        const existing = this.remoteIdentities[identifier];
        if (!existing) {
            return true; // TOFU (Trust On First Use)
        }
        // Check if key matches existing
        const oldBytes = new Uint8Array(existing);
        const newBytes = new Uint8Array(identityKey);
        if (oldBytes.length !== newBytes.length) return false;
        for (let i = 0; i < oldBytes.length; i++) {
            if (oldBytes[i] !== newBytes[i]) return false;
        }
        return true;
    }

    async loadIdentityKey(identifier: string): Promise<ArrayBuffer | undefined> {
        return this.remoteIdentities[identifier];
    }
    async loadPreKey(keyId: string | number): Promise<PreKeyRecord | undefined> {
        return this.preKeys[keyId];
    }
    async storePreKey(keyId: string | number, keyRecord: PreKeyRecord): Promise<void> {
        // console.log('[E2EE] storePreKey', keyId, typeof keyRecord, keyRecord);
        this.preKeys[keyId] = keyRecord;
        this.save();
    }
    async removePreKey(keyId: string | number): Promise<void> {
        delete this.preKeys[keyId];
        this.save();
    }

    async loadSession(identifier: string): Promise<SessionRecord | undefined> {
        const session = this.sessions[identifier];
        return session;
    }

    async deleteSession(identifier: string): Promise<void> {
        console.warn('[E2EE] Deleting session for', identifier);
        delete this.sessions[identifier];
        this.save();
    }

    async storeSession(identifier: string, record: SessionRecord): Promise<void> {
        // console.log('[E2EE] storeSession', identifier, typeof record);
        // If record has a serialize method, use it? The types say it's a string, but let's be sure.
        if (typeof record !== 'string' && record && typeof (record as any).serialize === 'function') {
            console.log('[E2EE] storeSession: Record IS an object with serialize(). converting...');
            this.sessions[identifier] = (record as any).serialize();
        } else {
            this.sessions[identifier] = record;
        }
        this.save();
    }
    async loadSignedPreKey(keyId: string | number): Promise<SignedPreKeyRecord | undefined> {
        return this.signedPreKeys[keyId];
    }
    async storeSignedPreKey(keyId: string | number, keyRecord: SignedPreKeyRecord): Promise<void> {
        // console.log('[E2EE] storeSignedPreKey', keyId, typeof keyRecord);
        this.signedPreKeys[keyId] = keyRecord;
        this.save();
    }
    async removeSignedPreKey(keyId: string | number): Promise<void> {
        delete this.signedPreKeys[keyId];
        this.save();
    }

    // Custom setter for initialization
    async setIdentity(keyPair: IdentityKeyPair, registrationId: number) {
        // Removed guard to allow overwriting if explicitly called (e.g. during regeneration)
        this.identityKeyPair = keyPair;
        this.localRegistrationId = registrationId;
        this.save();
    }

    hasIdentity(): boolean {
        return !!this.identityKeyPair && this.localRegistrationId !== undefined;
    }

    // Debug helper
    clear() {
        localStorage.removeItem(this.prefix + 'data');
        this.identityKeyPair = undefined;
        this.localRegistrationId = undefined;
        this.sessions = {};
        this.preKeys = {};
        this.signedPreKeys = {};
        this.remoteIdentities = {};
    }

    async validateConsistency(): Promise<boolean> {
        if (!this.identityKeyPair || !this.signedPreKeys) return true;

        // Check if SignedPreKeys are valid for this Identity
        const signedKeys = Object.values(this.signedPreKeys);
        if (signedKeys.length === 0) return true;

        try {
            const idKey = this.identityKeyPair;
            // We can't easily use internal libsignal verification here without importing 'Internal'.
            // But we can check basic things.

            // Check 1: Do we have keys?
            if (!idKey.pubKey || !idKey.privKey) return false;

            // Check 2: Are they arrays? (Already checked in getter, but good to double check)
            if (!(idKey.pubKey instanceof ArrayBuffer)) return false;

            // If we suspect mismatch, the best bet is to just Nuke if we keep seeing errors.
            // But let's try to simulate a signature check if possible? 
            // Without 'Internal.crypto', we can't easily verify the signature of the SignedPreKey.
            // HOWEVER, if we are in this state, it's safer to just reset if the user is stuck.

            console.log('[E2EE] Store consistency check passed (superficial).');

            // Check 3: Check SignedPreKeys (The likely culprit)
            for (const keyId in this.signedPreKeys) {
                const spk = this.signedPreKeys[keyId];
                if (!spk.keyPair || !spk.keyPair.privKey || !spk.keyPair.pubKey) {
                    console.error('[E2EE] Corrupted SignedPreKey (Missing KeyPair):', keyId);
                    return false;
                }
                if (!(spk.keyPair.privKey instanceof ArrayBuffer) || !(spk.keyPair.pubKey instanceof ArrayBuffer)) {
                    console.error('[E2EE] Corrupted SignedPreKey (Not ArrayBuffer):', keyId, spk.keyPair);
                    return false;
                }
                // Optional: Check length (Curve25519 keys are 32 bytes)
                if (spk.keyPair.privKey.byteLength !== 32) {
                    console.error('[E2EE] Corrupted SignedPreKey (Invalid Length):', keyId, spk.keyPair.privKey.byteLength);
                    return false;
                }
            }

            // Check 4: Check PreKeys
            for (const keyId in this.preKeys) {
                const pk = this.preKeys[keyId];
                if (!pk.keyPair || !pk.keyPair.privKey || !pk.keyPair.pubKey) {
                    console.error('[E2EE] Corrupted PreKey (Missing KeyPair):', keyId);
                    return false;
                }
                if (!(pk.keyPair.privKey instanceof ArrayBuffer) || !(pk.keyPair.pubKey instanceof ArrayBuffer)) {
                    console.error('[E2EE] Corrupted PreKey (Not ArrayBuffer):', keyId, pk.keyPair);
                    return false;
                }
            }

            return true;
        } catch (e) {
            console.error('[E2EE] Consistency check failed:', e);
            return false;
        }
    }
}

export class E2EEManager {
    private store: PersistentSignalProtocolStore;
    private userId: string;

    constructor(userId: string) {
        this.userId = userId;
        this.store = new PersistentSignalProtocolStore(`signal_${userId}_`);
    }

    async initialize() {
        // Run consistency check
        if (this.store.hasIdentity()) {
            // Heuristic: If we have an identity but no SignedPreKeys, or vice versa, something is wrong.
            const id = await this.store.getIdentityKeyPair();
            const signed = await this.store.loadSignedPreKey(1);

            if (!id || !signed) {
                console.warn('[E2EE] Broken Store State (Missing Identity or SignedKey). Nuking and Regenerating...');
                this.store.clear();
            }
        }

        if (this.store.hasIdentity()) {
            console.log('[E2EE] Identity found in local storage. Skipping generation.');
            // We need to return the public bundle assuming it's already on the server.
            // OR: We should probably return null and NOT upload to server to avoid overwriting.
            // But for now, let's regenerate the public bundle parts from the store to be safe (idempotent).

            const identityKeyPair = await this.store.getIdentityKeyPair();
            const registrationId = await this.store.getLocalRegistrationId();
            const preKey = await this.store.loadPreKey(1);
            const signedPreKey = await this.store.loadSignedPreKey(1);

            if (identityKeyPair && registrationId !== undefined && preKey && signedPreKey) {
                const idKeyB64 = this.arrayBufferToBase64(identityKeyPair.pubKey);
                const signedPreKeyPubB64 = this.arrayBufferToBase64(signedPreKey.keyPair.pubKey);
                const preKeyPubB64 = this.arrayBufferToBase64(preKey.keyPair.pubKey);

                // validate integrity
                if (idKeyB64.length > 0 && signedPreKeyPubB64.length > 0 && preKeyPubB64.length > 0) {
                    return {
                        registration_id: registrationId,
                        identity_key: idKeyB64,
                        signed_pre_key: {
                            keyId: 1,
                            publicKey: signedPreKeyPubB64,
                            signature: this.arrayBufferToBase64(signedPreKey.signature)
                        },
                        pre_key: {
                            keyId: 1,
                            publicKey: preKeyPubB64
                        }
                    };
                } else {
                    console.warn('[E2EE] Corrupted Identity found (Empty Keys). Regenerating...');
                    this.store.clear();
                    // Fall through to generation
                }
            } else {
                // Missing parts? regenerate
                console.warn('[E2EE] Incomplete Identity found. Regenerating...');
                this.store.clear();
            }
        }

        console.log('[E2EE] Generating new identity...');
        const registrationId = KeyHelper.generateRegistrationId();
        const identityKeyPair = await KeyHelper.generateIdentityKeyPair();

        console.log('[E2EE] Generated IdentityKeyPair:', identityKeyPair);
        if ((identityKeyPair as any).byteLength) {
            console.error('[E2EE] Generatred KeyPair IS an ArrayBuffer!', identityKeyPair);
        } else {
            console.log('[E2EE] KeyPair keys:', Object.keys(identityKeyPair));
        }

        await this.store.setIdentity(identityKeyPair, registrationId);

        // Generate PreKeys
        const baseKeyId = 1;
        const preKey = await KeyHelper.generatePreKey(baseKeyId);
        const signedPreKeyId = 1;
        const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);

        await this.store.storePreKey(baseKeyId, preKey);
        await this.store.storeSignedPreKey(signedPreKeyId, signedPreKey);

        // Public Bundle to be uploaded to Server
        return {
            registration_id: registrationId,
            identity_key: this.arrayBufferToBase64(identityKeyPair.pubKey),
            signed_pre_key: {
                keyId: signedPreKeyId,
                publicKey: this.arrayBufferToBase64(signedPreKey.keyPair.pubKey),
                signature: this.arrayBufferToBase64(signedPreKey.signature)
            },
            pre_key: {
                keyId: baseKeyId,
                publicKey: this.arrayBufferToBase64(preKey.keyPair.pubKey)
            }
        };
    }

    // --- Helpers ---
    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const binary = String.fromCharCode(...new Uint8Array(buffer));
        return btoa(binary);
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // --- Encryption Logic ---

    // Encrypt a message for a specific recipient (Signal Protocol)
    async encryptMessage(recipientId: string, message: string, getRecipientKeys: () => Promise<any>): Promise<any> {
        const address = new SignalProtocolAddress(recipientId, 1);
        const sessionBuilder = new SessionBuilder(this.store, address);

        // Check if we have a session, if not, build it from PreKey
        if (!(await this.store.loadSession(address.toString()))) {
            console.log(`[E2EE] No session for ${recipientId}, fetching keys...`);
            const remoteBundle = await getRecipientKeys();
            if (!remoteBundle) throw new Error(`Could not fetch keys for ${recipientId}`);

            // Process PreKey Bundle
            await sessionBuilder.processPreKey({
                registrationId: remoteBundle.registration_id,
                identityKey: this.base64ToArrayBuffer(remoteBundle.identity_key),
                signedPreKey: {
                    keyId: remoteBundle.signed_pre_key.keyId,
                    publicKey: this.base64ToArrayBuffer(remoteBundle.signed_pre_key.publicKey),
                    signature: this.base64ToArrayBuffer(remoteBundle.signed_pre_key.signature)
                },
                preKey: {
                    keyId: remoteBundle.pre_key.keyId,
                    publicKey: this.base64ToArrayBuffer(remoteBundle.pre_key.publicKey)
                }
            });
            console.log(`[E2EE] Session built for ${recipientId}`);
        }

        const cipher = new SessionCipher(this.store, address);
        const ciphertext = await cipher.encrypt(new TextEncoder().encode(message).buffer);

        // Debug: Check what libsignal actually returns
        // console.log('[E2EE] Ciphertext body type:', typeof ciphertext.body, ciphertext.body);

        let bodyBase64: string;
        if (typeof ciphertext.body === 'string') {
            // It's a binary string (Latin1)
            bodyBase64 = btoa(ciphertext.body);
        } else {
            // It's an ArrayBuffer
            bodyBase64 = this.arrayBufferToBase64(ciphertext.body as ArrayBuffer);
        }

        // Return simpler object for transport
        return {
            type: ciphertext.type, // 3 = PreKeyWhisperMessage, 1 = WhisperMessage
            body: bodyBase64
        };
    }

    // Decrypt an incoming message
    async decryptMessage(senderId: string, ciphertext: any): Promise<string> {
        const address = new SignalProtocolAddress(senderId, 1);
        const cipher = new SessionCipher(this.store, address);

        let plaintextBuffer: ArrayBuffer;

        try {
            if (ciphertext.type === 3) {
                // PreKey message (initial handshake)
                plaintextBuffer = await cipher.decryptPreKeyWhisperMessage(
                    this.base64ToArrayBuffer(ciphertext.body),
                    'binary'
                );
            } else {
                // Normal message
                plaintextBuffer = await cipher.decryptWhisperMessage(
                    this.base64ToArrayBuffer(ciphertext.body),
                    'binary'
                );
            }
            return new TextDecoder().decode(plaintextBuffer);
        } catch (e: any) {
            console.warn(`[E2EE] Decryption failed for sender ${senderId}:`, e.message);

            // Self-Healing logic
            const isCriticalError = e.message.includes('Invalid private key') ||
                e.message.includes('Incompatible version') ||
                e.message.includes('No record for device');

            if (isCriticalError) {
                // Prevent infinite loops: check if we just deleted this session recently?
                // Actually, if we delete it, loadSession returns undefined next time.
                // So we shouldn't get here again unless we negotiated a NEW session that is ALSO broken.

                // However, for history, we might want to just swallow the error if the session is ALREADY gone.
                const sessionExists = await this.store.loadSession(address.toString());
                if (sessionExists) {
                    console.warn(`[E2EE] Session for ${senderId} appears corrupted (${e.message}). Deleting to force renegotiation.`);
                    await this.store.deleteSession(address.toString());
                } else {
                    console.warn(`[E2EE] Session for ${senderId} already missing. Ignoring old message failure.`);
                }
            }

            // Return a safe placeholder so the UI doesn't crash or show raw JSON
            return "🔒 History unavailable (Session reset)";
        }
    }
}
