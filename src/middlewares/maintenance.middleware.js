import prisma from '../config/prisma.js';

let cachedMaintenanceMode = null;
let lastCheck = 0;

export const invalidateMaintenanceCache = () => {
  cachedMaintenanceMode = null;
  lastCheck = 0;
};

export const maintenanceMiddleware = async (req, res, next) => {
  try {
    const isWhitelisted =
      req.path === '/health' ||
      req.path === '/health/readiness' ||
      req.path.startsWith('/api/v1/health') ||
      req.path.startsWith('/api/v1/admin') ||
      req.path.startsWith('/api-docs') ||
      req.path === '/docs' ||
      req.path === '/api/v1/auth/login' ||
      req.path === '/api/v1/auth/refresh';

    if (isWhitelisted) {
      return next();
    }

    const now = Date.now();
    if (cachedMaintenanceMode === null || now - lastCheck > 10000) {
      const setting = await prisma.systemSetting.findUnique({
        where: { id: 'default' },
        select: { maintenanceMode: true },
      });
      cachedMaintenanceMode = Boolean(setting?.maintenanceMode);
      lastCheck = now;
    }

    if (cachedMaintenanceMode) {
      if (req.user && req.user.role === 'ADMIN') {
        return next();
      }

      return res.status(503).json({
        success: false,
        statusCode: 503,
        code: 'MAINTENANCE_MODE',
        message: 'المنصة حالياً في وضع الصيانة المجدولة، يرجى المحاولة لاحقاً',
      });
    }

    next();
  } catch (error) {
    next();
  }
};
