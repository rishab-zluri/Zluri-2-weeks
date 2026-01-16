/// <reference types="vite/client" />

declare module '*.jsx' {
    const content: any;
    export default content;
}

declare module '*.js' {
    const content: any;
    export default content;
    export const MainLayout: any;
    export const LoginPage: any;
    export const QuerySubmissionPage: any;
    export const MyQueriesPage: any;
    export const ApprovalDashboardPage: any;
    export const SecretsManagerPage: any;
    export const AuthProvider: any;
}
