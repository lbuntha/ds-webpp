// Environment configuration with type safety and validation

interface EnvConfig {
    // Firebase
    VITE_FIREBASE_API_KEY: string;
    VITE_FIREBASE_AUTH_DOMAIN: string;
    VITE_FIREBASE_PROJECT_ID: string;
    VITE_FIREBASE_STORAGE_BUCKET: string;
    VITE_FIREBASE_MESSAGING_SENDER_ID: string;
    VITE_FIREBASE_APP_ID: string;
    VITE_FIREBASE_MEASUREMENT_ID?: string;

    // App Config
    VITE_APP_NAME?: string;
    VITE_DEFAULT_LANGUAGE?: string;
}

class Environment {
    private config: EnvConfig;

    constructor() {
        this.config = this.loadConfig();
        this.validate();
    }

    private loadConfig(): EnvConfig {
        return {
            // Firebase
            VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY || '',
            VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
            VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
            VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
            VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
            VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID || '',
            VITE_FIREBASE_MEASUREMENT_ID: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,

            // App Config
            VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'Doorstep',
            VITE_DEFAULT_LANGUAGE: import.meta.env.VITE_DEFAULT_LANGUAGE || 'en',
        };
    }

    private validate(): void {
        const required: (keyof EnvConfig)[] = [
            'VITE_FIREBASE_API_KEY',
            'VITE_FIREBASE_AUTH_DOMAIN',
            'VITE_FIREBASE_PROJECT_ID',
            'VITE_FIREBASE_STORAGE_BUCKET',
            'VITE_FIREBASE_MESSAGING_SENDER_ID',
            'VITE_FIREBASE_APP_ID',
        ];

        const missing = required.filter(key => !this.config[key]);

        if (missing.length > 0) {
            console.error('Missing required environment variables:', missing);
            throw new Error(
                `Missing required environment variables: ${missing.join(', ')}. ` +
                'Please check your .env.local file.'
            );
        }
    }

    get firebase() {
        return {
            apiKey: this.config.VITE_FIREBASE_API_KEY,
            authDomain: this.config.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: this.config.VITE_FIREBASE_PROJECT_ID,
            storageBucket: this.config.VITE_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: this.config.VITE_FIREBASE_MESSAGING_SENDER_ID,
            appId: this.config.VITE_FIREBASE_APP_ID,
            measurementId: this.config.VITE_FIREBASE_MEASUREMENT_ID,
        };
    }

    get app() {
        return {
            name: this.config.VITE_APP_NAME!,
            defaultLanguage: this.config.VITE_DEFAULT_LANGUAGE!,
        };
    }

    get isDevelopment(): boolean {
        return import.meta.env.DEV;
    }

    get isProduction(): boolean {
        return import.meta.env.PROD;
    }
}

export const env = new Environment();
