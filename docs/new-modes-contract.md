# KODA Market exercise modes

All requests retain {exercise_id, code}. SQL code is native SELECT/WITH SQL. Excel/Power BI code is serialized JSON built from response_spec controls; it is not Python. Every mode runs inside the existing task execution subprocess. Free practice remains browser Pyodide only.

response_spec = {fields:[{key,label,type,options?}],initial:object}. Dot keys address nested object fields or numeric array indices. Supported types: text, number, select, checkbox, multiselect. The initial operation is fixed; fields contain the editable settings. Result shape stays {ok,result,stdout,execution_ms}; report result.kind is scalar with calculated data; SQL kind is dataframe. Validation compares calculations and semantic output against independently executed references. Key order and supported equivalent formulas are accepted.

Supported formulas: Excel =SUM(orders[revenue]), =COUNT/COUNTA(orders[order_id]), =AVERAGE(orders[revenue]), =SUM(...)/COUNT/COUNTA(...), =[@quantity]*[@price]-[@discount]. BI SUM(orders[revenue]), COUNTROWS(orders), COUNT(orders[order_id]), AVERAGE(orders[revenue]), DIVIDE(SUM(orders[revenue]),COUNTROWS(orders)). Case and whitespace are ignored. No expression evaluation or arbitrary extensions.

These simulators do not create .xlsx/.pbix files, run desktop Office, or claim full native feature coverage. Charts are calculated report specifications rendered by the frontend; interactions recalculate the selected city/channel aggregates. Written conclusions are structured metric/evidence claims.

## market-excel-001
KODA Market. Импортируйте CSV с запятой, заголовками, датой заказа и числовой выручкой; имя таблицы orders.
```json
{
  "fields": [
    {
      "key": "delimiter",
      "label": "Разделитель",
      "type": "select",
      "options": [
        ",",
        ";"
      ]
    },
    {
      "key": "headers",
      "label": "Первая строка — заголовки",
      "type": "checkbox"
    },
    {
      "key": "table",
      "label": "Имя таблицы",
      "type": "text"
    },
    {
      "key": "types.order_date",
      "label": "Тип даты",
      "type": "select",
      "options": [
        "date",
        "text",
        "number"
      ]
    },
    {
      "key": "types.revenue",
      "label": "Тип выручки",
      "type": "select",
      "options": [
        "number",
        "text"
      ]
    }
  ],
  "initial": {
    "operation": "import",
    "delimiter": "",
    "headers": false,
    "table": "",
    "types": {
      "order_date": "",
      "revenue": ""
    }
  }
}
```

## market-excel-002
KODA Market. Постройте сводную выручки по городам и категориям через поля отчёта.
```json
{
  "fields": [
    {
      "key": "group_by",
      "label": "Измерения",
      "type": "multiselect",
      "options": [
        "city",
        "category",
        "channel",
        "status"
      ]
    },
    {
      "key": "measure",
      "label": "Формула показателя",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "pivot",
    "group_by": [],
    "measure": ""
  }
}
```

## market-excel-003
KODA Market. Рассчитайте выручку каждой строки как количество × цена минус абсолютная скидка. Проверьте разницу с готовой выручкой.
```json
{
  "fields": [
    {
      "key": "formula",
      "label": "Формула вычисляемого столбца",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "formula",
    "formula": ""
  }
}
```

## market-excel-004
KODA Market. Выделите красным отменённые заказы по статусу.
```json
{
  "fields": [
    {
      "key": "column",
      "label": "Поле",
      "type": "select",
      "options": [
        "status",
        "channel",
        "city"
      ]
    },
    {
      "key": "equals",
      "label": "Равно",
      "type": "select",
      "options": [
        "Оплачен",
        "Отменён",
        "Возврат"
      ]
    },
    {
      "key": "style",
      "label": "Цвет",
      "type": "select",
      "options": [
        "red",
        "green",
        "blue"
      ]
    }
  ],
  "initial": {
    "operation": "format",
    "column": "",
    "equals": "",
    "style": ""
  }
}
```

## market-excel-005
KODA Market. Создайте три KPI: выручка, количество заказов и средний чек. Имена показателей revenue, orders_count, average_order.
```json
{
  "fields": [
    {
      "key": "measures.revenue",
      "label": "Выручка — формула",
      "type": "text"
    },
    {
      "key": "measures.orders_count",
      "label": "Количество — формула",
      "type": "text"
    },
    {
      "key": "measures.average_order",
      "label": "Средний чек — формула",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "kpis",
    "measures": {
      "revenue": "",
      "orders_count": "",
      "average_order": ""
    }
  }
}
```

## market-excel-006
KODA Market. Отберите заказы сайта из Москвы и проверьте число строк и сумму выручки.
```json
{
  "fields": [
    {
      "key": "filters.channel",
      "label": "Канал",
      "type": "select",
      "options": [
        "Сайт",
        "Приложение",
        "Магазин"
      ]
    },
    {
      "key": "filters.city",
      "label": "Город",
      "type": "select",
      "options": [
        "Москва",
        "Тула",
        "Волгоград"
      ]
    }
  ],
  "initial": {
    "operation": "filter",
    "filters": {
      "channel": "",
      "city": ""
    }
  }
}
```

## market-excel-007
KODA Market. Вычислите средний чек всех заказов формулой. Имя показателя average_order; округление проверяется до двух знаков.
```json
{
  "fields": [
    {
      "key": "measures.average_order",
      "label": "Формула среднего чека",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "measure",
    "measures": {
      "average_order": ""
    }
  }
}
```

## market-excel-008
KODA Market. Проверьте пропуски в оценке, номере заказа и дате; дополнительно проверьте повторные номера.
```json
{
  "fields": [
    {
      "key": "columns",
      "label": "Поля проверки",
      "type": "multiselect",
      "options": [
        "rating",
        "order_id",
        "order_date",
        "revenue",
        "city"
      ]
    }
  ],
  "initial": {
    "operation": "quality",
    "columns": []
  }
}
```

## market-excel-009
KODA Market. Подготовьте линейный график ежедневной выручки по дате заказа.
```json
{
  "fields": [
    {
      "key": "date_field",
      "label": "Поле даты",
      "type": "select",
      "options": [
        "order_date",
        "delivery_days"
      ]
    },
    {
      "key": "period",
      "label": "Период",
      "type": "select",
      "options": [
        "day",
        "month"
      ]
    },
    {
      "key": "visual",
      "label": "Визуализация",
      "type": "select",
      "options": [
        "bar",
        "line",
        "table"
      ]
    },
    {
      "key": "measure",
      "label": "Формула выручки",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "chart",
    "date_field": "",
    "period": "",
    "visual": "",
    "measure": ""
  }
}
```

## market-excel-010
KODA Market. Подкрепите вывод для руководителя: укажите город с наибольшей выручкой и числом общую выручку.
```json
{
  "fields": [
    {
      "key": "claims.0.metric",
      "label": "Вывод 1",
      "type": "select",
      "options": [
        "top_city",
        "top_channel"
      ]
    },
    {
      "key": "claims.0.value",
      "label": "Категория вывода 1",
      "type": "text"
    },
    {
      "key": "claims.1.metric",
      "label": "Вывод 2",
      "type": "select",
      "options": [
        "revenue",
        "cancelled_orders"
      ]
    },
    {
      "key": "claims.1.value",
      "label": "Число вывода 2",
      "type": "number"
    }
  ],
  "initial": {
    "operation": "insight",
    "claims": [
      {
        "metric": "",
        "value": ""
      },
      {
        "metric": "",
        "value": 0
      }
    ]
  }
}
```

## market-power-bi-001
KODA Market. Назначьте дату заказа как дату, выручку и номер заказа как числа, признак нового клиента как boolean.
```json
{
  "fields": [
    {
      "key": "types.order_date",
      "label": "Дата заказа",
      "type": "select",
      "options": [
        "date",
        "text",
        "number"
      ]
    },
    {
      "key": "types.revenue",
      "label": "Выручка",
      "type": "select",
      "options": [
        "number",
        "text"
      ]
    },
    {
      "key": "types.order_id",
      "label": "Номер",
      "type": "select",
      "options": [
        "number",
        "text"
      ]
    },
    {
      "key": "types.is_new_customer",
      "label": "Новый клиент",
      "type": "select",
      "options": [
        "boolean",
        "text"
      ]
    }
  ],
  "initial": {
    "operation": "import",
    "types": {
      "order_date": "",
      "revenue": "",
      "order_id": "",
      "is_new_customer": ""
    }
  }
}
```

## market-power-bi-002
KODA Market. Создайте карточки выручки и количества заказов. Назовите меры revenue и orders_count.
```json
{
  "fields": [
    {
      "key": "measures.revenue",
      "label": "DAX выручки",
      "type": "text"
    },
    {
      "key": "measures.orders_count",
      "label": "DAX количества",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "cards",
    "measures": {
      "revenue": "",
      "orders_count": ""
    }
  }
}
```

## market-power-bi-003
KODA Market. Создайте столбчатое сравнение выручки городов.
```json
{
  "fields": [
    {
      "key": "group_by",
      "label": "Измерение",
      "type": "multiselect",
      "options": [
        "city",
        "channel",
        "category",
        "status"
      ]
    },
    {
      "key": "visual",
      "label": "Визуализация",
      "type": "select",
      "options": [
        "bar",
        "line",
        "table"
      ]
    },
    {
      "key": "measure",
      "label": "DAX выручки",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "bar",
    "group_by": [],
    "visual": "",
    "measure": ""
  }
}
```

## market-power-bi-004
KODA Market. Добавьте фильтр канала Приложение и проверьте состав заказов и выручку отфильтрованного отчёта.
```json
{
  "fields": [
    {
      "key": "filters.channel",
      "label": "Канал",
      "type": "select",
      "options": [
        "Сайт",
        "Приложение",
        "Магазин"
      ]
    }
  ],
  "initial": {
    "operation": "slicer",
    "filters": {
      "channel": ""
    }
  }
}
```

## market-power-bi-005
KODA Market. Создайте DAX меру average_order: выручка на один заказ. Среднее проверяется до двух знаков.
```json
{
  "fields": [
    {
      "key": "measures.average_order",
      "label": "DAX среднего чека",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "measure",
    "measures": {
      "average_order": ""
    }
  }
}
```

## market-power-bi-006
KODA Market. Постройте линейную динамику общей выручки по месяцам даты заказа.
```json
{
  "fields": [
    {
      "key": "date_field",
      "label": "Поле даты",
      "type": "select",
      "options": [
        "order_date",
        "delivery_days"
      ]
    },
    {
      "key": "period",
      "label": "Период",
      "type": "select",
      "options": [
        "day",
        "month"
      ]
    },
    {
      "key": "visual",
      "label": "Визуализация",
      "type": "select",
      "options": [
        "bar",
        "line",
        "table"
      ]
    },
    {
      "key": "measure",
      "label": "DAX выручки",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "line",
    "date_field": "",
    "period": "",
    "visual": "",
    "measure": ""
  }
}
```

## market-power-bi-007
KODA Market. Сравните города по средней доставке и оценке только оплаченных заказов; столбчатая визуализация.
```json
{
  "fields": [
    {
      "key": "filters.status",
      "label": "Статус",
      "type": "select",
      "options": [
        "Оплачен",
        "Отменён",
        "Возврат"
      ]
    },
    {
      "key": "group_by",
      "label": "Разрез",
      "type": "select",
      "options": [
        "city",
        "channel"
      ]
    },
    {
      "key": "visual",
      "label": "Визуализация",
      "type": "select",
      "options": [
        "bar",
        "line",
        "table"
      ]
    }
  ],
  "initial": {
    "operation": "delivery",
    "filters": {
      "status": ""
    },
    "group_by": "",
    "visual": ""
  }
}
```

## market-power-bi-008
KODA Market. Выберите Москву в городском графике и настройте фильтрацию графика каналов. Проверьте пересчитанную выручку каналов.
```json
{
  "fields": [
    {
      "key": "selected_city",
      "label": "Выбранный город",
      "type": "select",
      "options": [
        "Москва",
        "Тула",
        "Волгоград"
      ]
    },
    {
      "key": "interaction",
      "label": "Взаимодействие",
      "type": "select",
      "options": [
        "filter",
        "none"
      ]
    }
  ],
  "initial": {
    "operation": "interactions",
    "selected_city": "",
    "interaction": ""
  }
}
```

## market-power-bi-009
KODA Market. Покажите выручку отдельно по статусам столбчатым графиком, сохраняя отмены и возвраты самостоятельными группами.
```json
{
  "fields": [
    {
      "key": "group_by",
      "label": "Измерение",
      "type": "multiselect",
      "options": [
        "status",
        "city",
        "channel"
      ]
    },
    {
      "key": "visual",
      "label": "Визуализация",
      "type": "select",
      "options": [
        "bar",
        "line",
        "table"
      ]
    },
    {
      "key": "measure",
      "label": "DAX выручки",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "status",
    "group_by": [],
    "visual": "",
    "measure": ""
  }
}
```

## market-power-bi-010
KODA Market. Подтвердите три вывода: лучший город по выручке, количество отменённых заказов и лучший канал по выручке.
```json
{
  "fields": [
    {
      "key": "claims.0.metric",
      "label": "Метрика 1",
      "type": "select",
      "options": [
        "top_city",
        "top_channel"
      ]
    },
    {
      "key": "claims.0.value",
      "label": "Категория 1",
      "type": "text"
    },
    {
      "key": "claims.1.metric",
      "label": "Метрика 2",
      "type": "select",
      "options": [
        "cancelled_orders",
        "revenue"
      ]
    },
    {
      "key": "claims.1.value",
      "label": "Число 2",
      "type": "number"
    },
    {
      "key": "claims.2.metric",
      "label": "Метрика 3",
      "type": "select",
      "options": [
        "top_city",
        "top_channel"
      ]
    },
    {
      "key": "claims.2.value",
      "label": "Категория 3",
      "type": "text"
    }
  ],
  "initial": {
    "operation": "insights",
    "claims": [
      {
        "metric": "",
        "value": ""
      },
      {
        "metric": "",
        "value": 0
      },
      {
        "metric": "",
        "value": ""
      }
    ]
  }
}
```
