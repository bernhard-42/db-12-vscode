export function getDatabases() {
    return 'print(";".join([f"{row.namespace}:" for row in spark.sql("show databases").collect()]))';
}

export function getTables(database: string) {
    return `print(";".join([f"{row.tableName}:{0 if row.isTemporary else 1}" for row in spark.sql("show tables in ${database}").collect()]))`;
}

export function getSchema(database: string, table: string) {
    return `print(";".join(([f"{c.name}:{c.dataType.simpleString()}" for c in spark.sql("select * from ${database}.${table}").schema.fields])))`;
}
