import { routes } from './app.routes';

describe('application routes', () => {
  it('exposes the administrator self-service credential route', () => {
    const route = routes.find((item) => item.path === 'my-credential');

    expect(route).toBeDefined();
    expect(route?.data).toMatchObject({
      role: 'admin',
      adminCredentialView: true,
    });
    expect(route?.canActivate).toBeDefined();
    expect(route?.loadComponent).toBeTypeOf('function');
  });

  it('keeps the administrative panel restricted to administrators', () => {
    const route = routes.find((item) => item.path === 'admin');

    expect(route?.data?.['role']).toBe('admin');
    expect(route?.canActivate).toBeDefined();
  });
});
