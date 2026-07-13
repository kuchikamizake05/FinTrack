export function shouldRegisterServiceWorker(environment: string | undefined, isServiceWorkerSupported: boolean) {
  return environment === "production" && isServiceWorkerSupported;
}
