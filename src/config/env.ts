// Environment configuration with type safety and validation

interface EnvConfig {
    // Firebase
    FIREBASE_API_KEY: string;
    FIREBASE_AUTH_DOMAIN: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_STORAGE_BUCKET: string;
    FIREBASE_MESSAGING_SENDER_ID: string;
    FIREBASE_APP_ID: string;
    FIREBASE_MEASUREMENT_ID?: string;

    // App Config
    VITE_APP_NAME?: string;
    VITE_DEFAULT_LANGUAGE?: string;
    VITE_API_URL?: string;
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
            FIREBASE_API_KEY: import.meta.env.FIREBASE_API_KEY || '',
            FIREBASE_AUTH_DOMAIN: import.meta.env.FIREBASE_AUTH_DOMAIN || '',
            FIREBASE_PROJECT_ID: import.meta.env.FIREBASE_PROJECT_ID || '',
            FIREBASE_STORAGE_BUCKET: import.meta.env.FIREBASE_STORAGE_BUCKET || '',
            FIREBASE_MESSAGING_SENDER_ID: import.meta.env.FIREBASE_MESSAGING_SENDER_ID || '',
            FIREBASE_APP_ID: import.meta.env.FIREBASE_APP_ID || '',
            FIREBASE_MEASUREMENT_ID: import.meta.env.FIREBASE_MEASUREMENT_ID,

            // App Config
            VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'Doorstep',
            VITE_DEFAULT_LANGUAGE: import.meta.env.VITE_DEFAULT_LANGUAGE || 'en',
            VITE_API_URL: import.meta.env.VITE_API_URL || 'https://api-lsv4ogyjva-uc.a.run.app',
        };
    }

    private validate(): void {
        const required: (keyof EnvConfig)[] = [
            'FIREBASE_API_KEY',
            'FIREBASE_AUTH_DOMAIN',
            'FIREBASE_PROJECT_ID',
            'FIREBASE_STORAGE_BUCKET',
            'FIREBASE_MESSAGING_SENDER_ID',
            'FIREBASE_APP_ID',
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
            apiKey: this.config.FIREBASE_API_KEY,
            authDomain: this.config.FIREBASE_AUTH_DOMAIN,
            projectId: this.config.FIREBASE_PROJECT_ID,
            storageBucket: this.config.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: this.config.FIREBASE_MESSAGING_SENDER_ID,
            appId: this.config.FIREBASE_APP_ID,
            measurementId: this.config.FIREBASE_MEASUREMENT_ID,
        };
    }

    get app() {
        return {
            name: this.config.VITE_APP_NAME!,
            defaultLanguage: this.config.VITE_DEFAULT_LANGUAGE!,
            apiUrl: this.config.VITE_API_URL!,
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
