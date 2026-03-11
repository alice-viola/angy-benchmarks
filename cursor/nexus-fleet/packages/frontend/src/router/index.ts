import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import type { UserRole } from '@nexus-fleet/shared';
import { useAuthStore } from '../stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    roles?: UserRole[];
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/shipments',
    name: 'ShipmentList',
    component: () => import('../views/ShipmentListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/shipments/new',
    name: 'ShipmentCreate',
    component: () => import('../views/ShipmentCreateView.vue'),
    meta: { requiresAuth: true, roles: ['owner', 'admin', 'dispatcher'] },
  },
  {
    path: '/shipments/:id',
    name: 'ShipmentDetail',
    component: () => import('../views/ShipmentDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/shipments/:id/edit',
    name: 'ShipmentEdit',
    component: () => import('../views/ShipmentEditView.vue'),
    meta: { requiresAuth: true, roles: ['owner', 'admin', 'dispatcher'] },
  },
  {
    path: '/vehicles',
    name: 'VehicleList',
    component: () => import('../views/VehicleListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/vehicles/:id',
    name: 'VehicleDetail',
    component: () => import('../views/VehicleDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/drivers',
    name: 'DriverList',
    component: () => import('../views/DriverListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/drivers/:id',
    name: 'DriverDetail',
    component: () => import('../views/DriverDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/routes',
    name: 'RouteList',
    component: () => import('../views/RouteListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/routes/new',
    name: 'RoutePlanner',
    component: () => import('../views/RoutePlannerView.vue'),
    meta: { requiresAuth: true, roles: ['owner', 'admin', 'dispatcher'] },
  },
  {
    path: '/routes/:id',
    name: 'RouteDetail',
    component: () => import('../views/RouteDetailView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/geofences',
    name: 'GeofenceList',
    component: () => import('../views/GeofenceListView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/geofences/new',
    name: 'GeofenceCreate',
    component: () => import('../views/GeofenceEditorView.vue'),
    meta: { requiresAuth: true, roles: ['owner', 'admin'] },
  },
  {
    path: '/geofences/:id/edit',
    name: 'GeofenceEdit',
    component: () => import('../views/GeofenceEditorView.vue'),
    meta: { requiresAuth: true, roles: ['owner', 'admin'] },
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings/webhooks',
    name: 'WebhookSettings',
    component: () => import('../views/WebhookSettingsView.vue'),
    meta: { requiresAuth: true, roles: ['owner', 'admin'] },
  },
  {
    path: '/settings/users',
    name: 'UserManagement',
    component: () => import('../views/UserManagementView.vue'),
    meta: { requiresAuth: true, roles: ['owner', 'admin'] },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const PUBLIC_ROUTES = new Set(['Login', 'Register']);

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  if (PUBLIC_ROUTES.has(to.name as string)) {
    if (authStore.isAuthenticated) {
      return next({ name: 'Dashboard' });
    }
    return next();
  }

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return next({ name: 'Login', query: { redirect: to.fullPath } });
  }

  if (to.meta.roles && to.meta.roles.length > 0 && authStore.user) {
    if (!to.meta.roles.includes(authStore.user.role)) {
      return next({ name: 'Dashboard' });
    }
  }

  return next();
});

export default router;
