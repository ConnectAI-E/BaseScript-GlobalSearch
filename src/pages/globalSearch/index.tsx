//@ts-nocheck
import { bitable, checkers, IFieldMeta, IFormViewMeta, IOpenCellValue, IWidgetField, IWidgetTable, IWidgetView, TableMeta, ViewType } from '@lark-base-open/js-sdk'
import { useEffect, useRef, useState } from 'react'
import { Form, Table, Select, Checkbox, Switch, Button, FormInstance, Spin, Collapse } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import React from 'react'
import './style.css'

interface TableInfo {
  table: IWidgetTable,
  /** 那个表格视图 */
  tableView: IFormViewMeta,
  fields: {
    valueList: any[],
    meta: IFieldMeta,
    field: IWidgetField,
  }[],
  fieldList: IWidgetField[],
  fieldMetaList: IFieldMeta[],
  /** 命中搜索的record和它的 */
  matchCells: {
    [recordId: string]: {
      meta: IFieldMeta,
      value: IOpenCellValue,
    }[]
  },
  /**表名 */
  name: string,
  dataSource: { key: string, [recordId: string]: IOpenCellValue }[],
  columns: any[]
}

export default function GlobalSearch() {
  const [tableList, setTableList] = useState<IWidgetTable[]>()
  const [selectTableRange, setSlectTableRange] = useState(false)
  const [tableMetaList, setTalbeMetaList] = useState<TableMeta[]>()

  const formValues = useRef<{
    // selectTableRangeSelf: boolean,
    tableIds: string[],
    search: string,
    usereg: boolean,
    detailSearch: boolean
  }>()
  const allTableInfo = useRef<TableInfo[]>()
  const [loading, setLoading] = useState(true)

  const [form] = Form.useForm();

  useEffect(() => {
    Promise.all(
      [bitable.base.getTableMetaList().then((tableMetaList) => {
        setTalbeMetaList(tableMetaList)
      }),
      bitable.base.getTableList().then((tableList) => {
        setTableList(tableList)
      })]).then(() => {
        setLoading(false)
      })
  }, [])



  const search = async () => {
    const { tableIds, usereg, search, detailSearch } = form.getFieldsValue();
    /** 需要查找的表格 */
    const tables = tableIds ? tableList?.filter(({ id }) => tableIds.includes(id)) : tableList;
    setLoading(true);
    allTableInfo.current = []
    const getTableInfo = tables!.map(async (table, index) => {
      try {
        const fieldList = await table.getFieldList();
        const fieldMetaList = await table.getFieldMetaList();
        const viewMetaList = await table.getViewMetaList();
        const tableName = await table.getName();
        const tableView = viewMetaList.find(({ type }) => type === ViewType.Grid)
        allTableInfo.current![index] = ({
          table,
          fieldList,
          fieldMetaList,
          tableView,
          name: tableName,
          fields: []
        } as any)
        await Promise.all(fieldList.map(async (field) => {
          try {

            const valueList = await field.getFieldValueList();
            const meta = fieldMetaList.find(({ id }) => id === field.id)
            allTableInfo.current![index].fields.push({
              meta: meta!,
              field,
              valueList
            })
          } catch (error) {
            console.error('获取valueList报错：');
            const tableName = await table.getName();
            const meta = await field.getMeta();
            console.log({ table, field, meta, tableName })
          }
        }))
      } catch (error) {
        console.error('报错了--------');
        console.log(table)
      }

    })

    await Promise.all(getTableInfo)
    const ifMatchCell = getIfMatchCellFromSearch({ search, usereg, detailSearch })
    setMatchCellInTableInfo({ ifMatchCell, tableInfos: allTableInfo.current! })
    setDataSourceAndColumnsOfTalbeInfos(allTableInfo.current!, formValues);
    setLoading(false)
  }

  return <div>
    <Spin spinning={loading}>
      <Form
        onValuesChange={(changedField, changedFormValues) => {
          formValues.current = changedFormValues
        }}
        form={form}
        onFinish={search}
        layout='vertical'>
        {/* <Form.Item
                    initialValue={selectTableRange}
                    name={'selectTableRangeSelf'}
                    valuePropName='checked'
                    label='自定义数据表范围'>
                    <Switch onChange={(v) => { setSlectTableRange(v); form.setFieldValue('search', undefined) }}></Switch>
                </Form.Item> */}
        {!loading && <Form.Item
          name={'tableIds'}
          initialValue={tableMetaList?.map(({ id }) => id)}
          rules={[{ required: true, message: t('search.table.desc') }]}
          label={t('search.table.label')}>
          <Select
            mode='multiple'
            options={tableMetaList?.map(({ id, name }) => ({ label: name, value: id }))}
          >
          </Select>
        </Form.Item>}




        <Form.Item
          rules={[{ required: true, message: t('plz.enter.1') }]}
          name={'search'} label={t('search.label')}>
          <TextArea>
          </TextArea>
        </Form.Item>

        <Form.Item className='rowItem' name={'usereg'} valuePropName='checked' label={t('search.usereg')}>
          <Switch></Switch>
        </Form.Item>

        <Form.Item className='rowItem' tooltip={t('search.tooltip')} name={'detailSearch'} valuePropName='checked' label={t('search.detail')}>
          <Switch></Switch>
        </Form.Item>
        <Form.Item>
          <SubmitButton form={form}></SubmitButton>
        </Form.Item>


      </Form>
      <RenderTable tableInfos={allTableInfo.current}></RenderTable>
    </Spin>
  </div>
}

const SubmitButton = ({ form }: { form: FormInstance }) => {
  const [submittable, setSubmittable] = React.useState(false);

  // Watch all values
  const values = Form.useWatch([], form);

  React.useEffect(() => {
    form.validateFields({ validateOnly: true }).then(
      () => {
        setSubmittable(true);
      },
      () => {
        setSubmittable(false);
      },
    );
  }, [values]);

  return (
    <Button type="primary" htmlType="submit" disabled={!submittable}>
      {/* 搜索 */}
      {t('btn.search')}
    </Button>
  );
};

/** 过滤出TableInfo的matchCells字段 */
function setMatchCellInTableInfo({ tableInfos, ifMatchCell }: {
  tableInfos: TableInfo[],
  /** 该单元格的值是否命中搜索 */
  ifMatchCell: (v: IOpenCellValue | undefined | null) => boolean | string
}) {
  tableInfos.map((v) => {
    v.matchCells = {}
    v.fields.forEach(({ valueList, meta }) => {
      valueList.forEach(({ record_id, value }) => {
        const matchValurStr = ifMatchCell(value)
        if (matchValurStr) {
          if (!v.matchCells[record_id]) {
            v.matchCells[record_id] = [{
              meta,
              value: matchValurStr // 最终将要传给dataSource的东西
            }]
          } else {
            v.matchCells[record_id].push({ meta, value: matchValurStr })
          }
        }
      })
    })
  })
}

/** 根据表单项search和usereg获取一个判断单元格的值是否符合search的函数；该函数返回被判断的单元格的值/false */
function getIfMatchCellFromSearch({ search, usereg, detailSearch }: {
  search: string,
  usereg: string,
  /** 精细搜索，直接搜索json化后字段的原始值 */
  detailSearch: boolean
}) {
  const reg = usereg && createRegexFromString(search)
  return function ifMatchCell(v: IOpenCellValue | undefined | null) {
    let valueStr: string[] | string = ''
    if (typeof v === 'undefined' || typeof v === 'boolean' || v === null) {
      return false
    }
    if (typeof v === 'number') {
      valueStr = String(v)
    }
    if (detailSearch) {
      valueStr = JSON.stringify(v, null, '  ')
    } else {
      if (Array.isArray(v)) {
        //@ts-ignore
        valueStr = v.map(({ text, name, enName, en_name, link }) => text || name || enName || en_name || link)
      }
      if (!Array.isArray(v) && typeof v === 'object') {
        //@ts-ignore
        valueStr = v.text || v.fullAddress || v.link
      }
    }



    if (reg) {
      if (Array.isArray(valueStr)) {
        return valueStr.some((valueStrSingleValue) => reg.test(valueStrSingleValue)) ? valueStr.join('') : false
      }
      return reg.test(String(valueStr)) ? String(valueStr) : false
    } else {
      if (Array.isArray(valueStr)) {
        return valueStr.some((valueStrSingleValue) => valueStrSingleValue?.includes?.(search)) ? valueStr.join('') : false
      }
      return valueStr.includes(search) ? valueStr : false
    }
  }
}

function createRegexFromString(str: string) {
  const regexParts = str.trim().match(/\/(.*)\/([gimyus]{0,6})/);

  if (regexParts && regexParts.length >= 3) {
    const pattern = regexParts[1];
    const flags = regexParts[2];

    const regex = new RegExp(pattern, flags);

    return regex;
  } else {
    throw new Error('Invalid regular expression string');
  }
}

/**生成tableInfos.dataSource和columns */
function setDataSourceAndColumnsOfTalbeInfos(tableInfos: TableInfo[], formValues: any) {
  tableInfos.map((tableInfo) => {
    let columns: any = []
    let dataSource = []
    let column: any = {}
    for (const recordId in tableInfo.matchCells) {
      const recordValues = tableInfo.matchCells[recordId]
      const record: any = {
        key: recordId
      }
      recordValues.map(({ meta, value }) => {
        record[meta.id] = value
        column[meta.id] = {
          title: meta.name,
          key: meta.id,
          dataIndex: meta.id,
          // ellipsis: {
          //     showTitle: true,
          // },
          render: (value: string) => {
            return <div style={{ maxHeight: '160px', overflow: 'scroll' }}>
              <RenderHeighLightTextWithMatchStr str={value} search={formValues.current.search} usereg={formValues.current.usereg} /></div>  // TODO 如何渲染各种类型单元格?
          }
        }
      })
      dataSource.push(record);
    }
    tableInfo.dataSource = dataSource;
    columns.push(...Object.values(column))
    columns.push({
      key: 'action',
      title: t('action'),
      fixed: 'right',
      width: 100,
      render: (record: any) => {
        return <div style={{ cursor: 'pointer', color: '#1890ff' }} onClick={async () => {
          const recordKeys = Object.keys(record)
          const fieldId = recordKeys[0] === 'key' ? recordKeys[1] : recordKeys[0]
          const url = await bitable.bridge.getBitableUrl({ tableId: tableInfo.table.id, viewId: tableInfo.tableView.id, recordId: record.key, fieldId })
          window.open(url)
        }}>{t('open.new.window')}</div>
      }
    })
    tableInfo.columns = columns;
  })
}


function RenderTable({ tableInfos }: { tableInfos?: TableInfo[] }) {
  if (!Array.isArray(tableInfos)) {
    return null
  }
  const items = tableInfos.filter(({ dataSource }) => dataSource?.length).map(({ dataSource, columns, name }, index) => {
    return {
      key: String(index),
      label: <div style={{ fontWeight: 'bold' }} >{name}</div>,
      children: <Table scroll={{ x: window.innerWidth + columns.length * 100, y: window.innerHeight - 100 }} dataSource={dataSource} columns={columns} pagination={{ position: ['bottomRight'] }}></Table>
    }
  })

  return <div>
    <Collapse items={items} defaultActiveKey={['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']}></Collapse>
  </div>
}

function RenderHeighLightTextWithMatchStr({ str, search, usereg }: {
  str: string,
  /** 正则表达式/搜索的字符串 */
  search: string,
  usereg: boolean
}) {
  if (!str) {
    return null
  }
  let matchesStringResult: string | string[] = search as any
  if (usereg) {
    matchesStringResult = str.match(createRegexFromString(search))!
  }

  /** 去重后的匹配到的字符串 */
  let match = new Set<string>()
  if (Array.isArray(matchesStringResult)) {
    match = new Set(matchesStringResult)
  } else if (typeof search === 'string') {
    match.add(search)
  }
  let replacedStr = str
  match.forEach((m) => {
    if (usereg) {
      if (search.split('/').slice(-1)[0].includes('g')) {
        replacedStr = replacedStr.replaceAll(m, `<span class="light-text">${m}</span>`)
        return;
      } else {
        replacedStr = replacedStr.replace(m, `<span class="light-text">${m}</span>`)
        return
      }
    }
    replacedStr = replacedStr.replaceAll(m, `<span class="light-text">${m}</span>`)
  })

  return <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: replacedStr }}></div>

}
