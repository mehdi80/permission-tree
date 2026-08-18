import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { PERMISSION_SEARCH_GATEWAY } from './features/permissions/data-access/permission-search.gateway';
import { MockPermissionSearchGateway } from './features/permissions/data-access/mock-permission-search.gateway';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
      provide:
        PERMISSION_SEARCH_GATEWAY,

      useExisting:
        MockPermissionSearchGateway,
    },
  ]
};
