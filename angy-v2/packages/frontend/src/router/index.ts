import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  // Auth routes (public)
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { layout: 'auth', public: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/RegisterView.vue'),
    meta: { layout: 'auth', public: true },
  },
  // App routes (require auth)
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { layout: 'app', title: 'Dashboard' },
  },
  {
    path: '/shipments',
    name: 'shipments',
    component: () => import('../views/ShipmentListView.vue'),
    meta: { layout: 'app', title: 'Shipments' },
  },
  {
    path: '/shipments/create',
    name: 'shipment-create',
    component: () => import('../views/ShipmentCreateView.vue'),
    meta: { layout: 'app', title: 'Create Shipment' },
  },
  {
    path: '/shipments/:id',
    name: 'shipment-detail',
    component: () => import('../views/ShipmentDetailView.vue'),
    meta: { layout: 'app', title: 'Shipment Details' },
  },
  {
    path: '/shipments/:id/edit',
    name: 'shipment-edit',
    component: () => import('../views/ShipmentEditView.vue'),
    meta: { layout: 'app', title: 'Edit Shipment' },
  },
  {
    path: '/vehicles',
    name: 'vehicles',
    component: () => import('../views/VehicleListView.vue'),
    meta: { layout: 'app', title: 'Vehicles' },
  },
  {
    path: '/vehicles/:id',
    name: 'vehicle-detail',
    component: () => import('../views/VehicleDetailView.vue'),
    meta: { layout: 'app', title: 'Vehicle Details' },
  },
  {
    path: '/drivers',
    name: 'drivers',
    component: () => import('../views/DriverListView.vue'),
    meta: { layout: 'app', title: 'Drivers' },
  },
  {
    path: '/drivers/:id',
    name: 'driver-detail',
    component: () => import('../views/DriverDetailView.vue'),
    meta: { layout: 'app', title: 'Driver Details' },
  },
  {
    path: '/routes',
    name: 'routes',
    component: () => import('../views/RouteListView.vue'),
    meta: { layout: 'app', title: 'Routes' },
  },
  {
    path: '/routes/:id',
    name: 'route-detail',
    component: () => import('../views/RouteDetailView.vue'),
    meta: { layout: 'app', title: 'Route Details' },
  },
  {
    path: '/routes/plan',
    name: 'route-planner',
    component: () => import('../views/RoutePlannerView.vue'),
    meta: { layout: 'app', title: 'Route Planner' },
  },
  {
    path: '/geofences',
    name: 'geofences',
    component: () => import('../views/GeofenceListView.vue'),
    meta: { layout: 'app', title: 'Geofences' },
  },
  {
    path: '/geofences/:id/edit',
    name: 'geofence-editor',
    component: () => import('../views/GeofenceEditorView.vue'),
    meta: { layout: 'app', title: 'Edit Geofence' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { layout: 'app', title: 'Settings' },
  },
  {
    path: '/settings/webhooks',
    name: 'webhook-settings',
    component: () => import('../views/WebhookSettingsView.vue'),
    meta: { layout: 'app', title: 'Webhooks' },
  },
  {
    path: '/settings/users',
    name: 'user-management',
    component: () => import('../views/UserManagementView.vue'),
    meta: { layout: 'app', title: 'User Management' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  if (to.meta.public) {
    next();
    return;
  }

  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } });
  } else {
    next();
  }
});

export default router;
