import type { Category } from '~/types/category.type'
import type { SuccessResponse } from '~/types/utils.type'
import http from '~/utils/http'

const URL = 'categories'

const categoryApi = {
  getCategories() {
    return http.get<SuccessResponse<Category[]>>(URL)
  }
}

export default categoryApi
