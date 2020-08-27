export function librariesCode() {
    return 'import sys, pkg_resources, json; ' +
        'print(json.dumps(' +
        '[{"name": "python", "version": "%d.%d.%d" % (sys.version_info.major, sys.version_info.minor, sys.version_info.micro)}] + ' +
        '[{"name": "pyspark", "version": spark.version}] + ' +
        '[{"name":p.key, "version":p.version} for p in pkg_resources.working_set]))';
}
