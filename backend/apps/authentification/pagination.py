from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'   # ?page_size=1000 pour remplir une liste déroulante
    max_page_size = 1000