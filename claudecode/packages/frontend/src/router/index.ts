import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { layout: 'auth', requiresAuth: false },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { layout: 'auth', requiresAuth: false },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Dashboard', requiresAuth: true },
  },
  {
    path: '/shipments',
    name: 'shipments',
    component: () => import('@/views/ShipmentListView.vue'),
    meta: { title: 'Shipments', requiresAuth: true },
  },
  {
    path: '/shipments/new',
    name: 'shipment-create',
    component: () => import('@/views/ShipmentCreateView.vue'),
    meta: { title: 'New Shipment', requiresAuth: true },
  },
  {
    path: '/shipments/:id',
    name: 'shipment-detail',
    component: () => import('@/views/ShipmentDetailView.vue'),
    meta: { title: 'Shipment Details', requiresAuth: true },
  },
  {
    path: '/shipments/:id/edit',
    name: 'shipment-edit',
    component: () => import('@/views/ShipmentEditView.vue'),
    meta: { title: 'Edit Shipment', requiresAuth: true },
  },
  {
    path: '/vehicles',
    name: 'vehicles',
    component: () => import('@/views/VehicleListView.vue'),
    meta: { title: 'Vehicles', requiresAuth: true },
  },
  {
    path: '/vehicles/:id',
    name: 'vehicle-detail',
    component: () => import('@/views/VehicleDetailView.vue'),
    meta: { title: 'Vehicle Details', requiresAuth: true },
  },
  {
    path: '/drivers',
    name: 'drivers',
    component: () => import('@/views/DriverListView.vue'),
    meta: { title: 'Drivers', requiresAuth: true },
  },
  {
    path: '/drivers/:id',
    name: 'driver-detail',
    component: () => import('@/views/DriverDetailView.vue'),
    meta: { title: 'Driver Details', requiresAuth: true },
  },
  {
    path: '/routes',
    name: 'routes',
    component: () => import('@/views/RouteListView.vue'),
    meta: { title: 'Routes', requiresAuth: true },
  },
  {
    path: '/routes/new',
    name: 'route-planner',
    component: () => import('@/views/RoutePlannerView.vue'),
    meta: { title: 'Route Planner', requiresAuth: true },
  },
  {
    path: '/routes/:id',
    name: 'route-detail',
    component: () => import('@/views/RouteDetailView.vue'),
    meta: { title: 'Route Details', requiresAuth: true },
  },
  {
    path: '/geofences',
    name: 'geofences',
    component: () => import('@/views/GeofenceListView.vue'),
    meta: { title: 'Geofences', requiresAuth: true },
  },
  {
    path: '/geofences/new',
    name: 'geofence-create',
    component: () => import('@/views/GeofenceEditorView.vue'),
    meta: { title: 'New Geofence', requiresAuth: true },
  },
  {
    path: '/geofences/:id/edit',
    name: 'geofence-edit',
    component: () => import('@/views/GeofenceEditorView.vue'),
    meta: { title: 'Edit Geofence', requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings', requiresAuth: true },
  },
  {
    path: '/settings/webhooks',
    name: 'webhook-settings',
    component: () => import('@/views/WebhookSettingsView.vue'),
    meta: { title: 'Webhook Settings', requiresAuth: true },
  },
  {
    path: '/settings/users',
    name: 'user-management',
    component: () => import('@/views/UserManagementView.vue'),
    meta: { title: 'User Management', requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
  } else if (
    (to.name === 'login' || to.name === 'register') &&
    authStore.isAuthenticated
  ) {
    next({ name: 'dashboard' });
  } else {
    next();
  }
});

export default router;
