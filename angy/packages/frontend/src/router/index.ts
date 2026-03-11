import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import type { Role } from '@nexus-fleet/shared';
import { useAuthStore } from '@/stores/auth.store';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiredRoles?: Role[];
    layout?: 'auth' | 'default';
    breadcrumb?: string;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { layout: 'auth', breadcrumb: 'Login' },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { layout: 'auth', breadcrumb: 'Register' },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Dashboard' },
  },
  {
    path: '/shipments',
    name: 'shipments',
    component: () => import('@/views/ShipmentsView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Shipments' },
  },
  {
    path: '/shipments/new',
    name: 'shipment-new',
    component: () => import('@/views/ShipmentNewView.vue'),
    meta: {
      requiresAuth: true,
      requiredRoles: ['owner', 'admin', 'dispatcher'],
      breadcrumb: 'New Shipment',
    },
  },
  {
    path: '/shipments/:id',
    name: 'shipment-detail',
    component: () => import('@/views/ShipmentDetailView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Shipment Detail' },
  },
  {
    path: '/shipments/:id/edit',
    name: 'shipment-edit',
    component: () => import('@/views/ShipmentEditView.vue'),
    meta: {
      requiresAuth: true,
      requiredRoles: ['owner', 'admin', 'dispatcher'],
      breadcrumb: 'Edit Shipment',
    },
  },
  {
    path: '/vehicles',
    name: 'vehicles',
    component: () => import('@/views/VehiclesView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Vehicles' },
  },
  {
    path: '/vehicles/:id',
    name: 'vehicle-detail',
    component: () => import('@/views/VehicleDetailView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Vehicle Detail' },
  },
  {
    path: '/drivers',
    name: 'drivers',
    component: () => import('@/views/DriversView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Drivers' },
  },
  {
    path: '/drivers/:id',
    name: 'driver-detail',
    component: () => import('@/views/DriverDetailView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Driver Detail' },
  },
  {
    path: '/routes',
    name: 'routes',
    component: () => import('@/views/RoutesView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Routes' },
  },
  {
    path: '/routes/new',
    name: 'route-new',
    component: () => import('@/views/RouteNewView.vue'),
    meta: {
      requiresAuth: true,
      requiredRoles: ['owner', 'admin', 'dispatcher'],
      breadcrumb: 'New Route',
    },
  },
  {
    path: '/routes/:id',
    name: 'route-detail',
    component: () => import('@/views/RouteDetailView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Route Detail' },
  },
  {
    path: '/routes/:id/plan',
    name: 'route-plan',
    component: () => import('@/views/RoutePlanView.vue'),
    meta: {
      requiresAuth: true,
      requiredRoles: ['owner', 'admin', 'dispatcher'],
      breadcrumb: 'Route Plan',
    },
  },
  {
    path: '/geofences',
    name: 'geofences',
    component: () => import('@/views/GeofencesView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Geofences' },
  },
  {
    path: '/geofences/new',
    name: 'geofence-new',
    component: () => import('@/views/GeofenceNewView.vue'),
    meta: {
      requiresAuth: true,
      requiredRoles: ['owner', 'admin'],
      breadcrumb: 'New Geofence',
    },
  },
  {
    path: '/geofences/:id',
    name: 'geofence-detail',
    component: () => import('@/views/GeofenceDetailView.vue'),
    meta: { requiresAuth: true, breadcrumb: 'Geofence Detail' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: {
      requiresAuth: true,
      requiredRoles: ['owner', 'admin'],
      breadcrumb: 'Settings',
    },
  },
  {
    path: '/settings/webhooks',
    name: 'settings-webhooks',
    component: () => import('@/views/SettingsWebhooksView.vue'),
    meta: {
      requiresAuth: true,
      requiredRoles: ['owner', 'admin'],
      breadcrumb: 'Webhooks',
    },
  },
  {
    path: '/settings/users',
    name: 'settings-users',
    component: () => import('@/views/SettingsUsersView.vue'),
    meta: {
      requiresAuth: true,
      requiredRoles: ['owner', 'admin'],
      breadcrumb: 'Users',
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();

  const publicRoutes = ['login', 'register'];
  const isPublic = publicRoutes.includes(to.name as string);

  if (isPublic && auth.isAuthenticated) {
    return next('/dashboard');
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return next('/login');
  }

  if (to.meta.requiredRoles && auth.user) {
    if (!to.meta.requiredRoles.includes(auth.user.role)) {
      return next('/dashboard');
    }
  }

  next();
});

export default router;
