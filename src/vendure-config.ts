import {
    dummyPaymentHandler,
    DefaultJobQueuePlugin,
    DefaultSearchPlugin,
    VendureConfig,
} from '@vendure/core';
import { StripePlugin } from '\@vendure/payments-plugin/package/stripe';
import { defaultEmailHandlers, EmailPlugin } from '@vendure/email-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import 'dotenv/config';
import path from 'path';
import { SES, SendRawEmailCommand } from '@aws-sdk/client-ses'

const ses = new SES({
    apiVersion: '2010-12-01',
    region: 'eu-central-1',
    credentials: {
        accessKeyId: process.env.SES_ACCESS_KEY || '',
        secretAccessKey: process.env.SES_SECRET_KEY || '',
    },
});
const IS_DEV = process.env.APP_ENV === 'dev';

export const config: VendureConfig = {
    apiOptions: {
        port: +(process.env.PORT || 3000),
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        // The following options are useful in development mode,
        // but are best turned off for production for security
        // reasons.
        ...(IS_DEV ? {
            adminApiPlayground: {
                settings: { 'request.credentials': 'include' },
            },
            adminApiDebug: true,
            shopApiPlayground: {
                settings: { 'request.credentials': 'include' },
            },
            shopApiDebug: true,
        } : {}),
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
            secret: process.env.COOKIE_SECRET,
        },
    },
    dbConnectionOptions: {
        type: 'postgres',
        // See the README.md "Migrations" section for an explanation of
        // the `synchronize` and `migrations` options.
        synchronize: false,
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: false,
        database: process.env.DB_NAME,
        schema: process.env.DB_SCHEMA,
        host: process.env.DB_HOST,
        port: +process.env.DB_PORT,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
    },
    paymentOptions: {
        paymentMethodHandlers: [dummyPaymentHandler],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    customFields: {},
    plugins: [
        StripePlugin.init({
            // This prevents different customers from using the same PaymentIntent
            storeCustomersInStripe: true,
        }),
        EmailPlugin.init({
            handlers: defaultEmailHandlers,
            templatePath: path.join(__dirname, 'static/email/templates'),
            transport: {
                type: 'ses',
                SES: { ses, aws: { SendRawEmailCommand } },
                sendingRate: 10, // optional messages per second sending rate
            },
        }),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: process.env.ASSET_UPLOAD_DIR || path.join(__dirname, '../static/assets'),
            // For local dev, the correct value for assetUrlPrefix should
            // be guessed correctly, but for production it will usually need
            // to be set manually to match your production url.
            assetUrlPrefix: IS_DEV ? undefined : 'https://www.my-shop.com/assets/',
        }),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        EmailPlugin.init({
            devMode: true,
            outputPath: path.join(__dirname, '../static/email/test-emails'),
            route: 'mailbox',
            handlers: defaultEmailHandlers,
            templatePath: path.join(__dirname, '../static/email/templates'),
                globalTemplateVars: {
                // The following variables will change depending on your storefront implementation.
                // Here we are assuming a storefront running at http://localhost:8080.
                fromAddress: '"example" <noreply@example.com>',
                verifyEmailAddressUrl: 'http://localhost:3001/customer/verify',
                passwordResetUrl: 'http://localhost:3001/customer/reset-password',
                changeEmailAddressUrl: 'http://localhost:3001/customer/verify-email-address-change'
            },
        }),
        AdminUiPlugin.init({
            route: 'admin',
            port: 3002,
           
        }),
    ],
};
