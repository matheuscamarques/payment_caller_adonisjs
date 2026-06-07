/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

const PaymentsController = () => import('#payments/interfaces/http/controllers/payments_controller')

router.get('/', async () => ({ status: 'ok' }))

router
  .group(() => {
    router.post('payments', [PaymentsController, 'store'])
    router.get('payments/:paymentId', [PaymentsController, 'show'])
  })
  .prefix('/api/v1')
