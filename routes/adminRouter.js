const express = require('express') 
const admin_router = express()
const session = require('express-session')
const config = require('../config/session')
const passport = require('passport');
const adminController = require('../controllers/adminController')
admin_router.use(session({
    secret:config.adminSession,
    resave : false,
    saveUninitialized : true,
    cookie : {secure:false}
}))

admin_router.use(passport.initialize());
admin_router.use(passport.session());
const auth = require('../middleware/adminAuthentication')

admin_router.set('view engine','ejs')
admin_router.set('views','./views/admin')
admin_router.set('layout','../layouts/layout')

admin_router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'] 
  }));
admin_router.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/admin/login', 
  }), (req, res) => {
    console.log('User authenticated:', req.user);
    console.log('Session Data:', req.session);
      res.redirect(req.session.originalUrl || '/admin');
  });

admin_router.get('/',auth.isLogin,adminController.loadDashboard)
admin_router.get('/login',auth.isLogout,adminController.loadAdminLogin)
admin_router.get('/signout',auth.isLogin,adminController.signOut)
admin_router.get('/category',auth.isLogin,adminController.loadAddCategory)
admin_router.get('/user-management',auth.isLogin,adminController.loadUserManagement)
admin_router.get('/tickets',auth.isLogin,adminController.loadTickets)
admin_router.get('/ticket/:ticketId',auth.isLogin,adminController.openTicket)


admin_router.post('/login',auth.isLogout,adminController.adminLogin)
admin_router.post('/add-category',auth.isLogin,adminController.addCategory)
admin_router.post('/delete-category/:id',auth.isLogin,adminController.deleteCategory)
admin_router.post('/delete-user/:id',auth.isLogin,adminController.deleteUser)
admin_router.post('/tickets/reply/:ticketId',auth.isLogin,adminController.ticketReplay)

module.exports = admin_router