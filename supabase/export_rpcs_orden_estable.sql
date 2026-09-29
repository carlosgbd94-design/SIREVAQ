-- fetchAllRpc pagina con .range(0,999),(1000,1999)...; con ORDER BY solo por fecha (empates) las paginas podian
-- traslaparse o perder filas (cada mes tiene >1000 renglones). Se agrega id como desempate.
CREATE OR REPLACE FUNCTION public.get_export_bio_range_bypass(p_fecha_inicio date, p_fecha_fin date)
 RETURNS SETOF biologicos_pedido LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT * FROM public.biologicos_pedido
    WHERE fecha_pedido_programada >= p_fecha_inicio AND fecha_pedido_programada <= p_fecha_fin
    ORDER BY fecha_pedido_programada DESC, id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_export_sr_range_bypass(p_fecha_inicio date, p_fecha_fin date)
 RETURNS SETOF biologicos_existencia LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT * FROM public.biologicos_existencia
    WHERE fecha >= p_fecha_inicio AND fecha <= p_fecha_fin
    ORDER BY fecha DESC, id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_export_cons_range_bypass(p_fecha_inicio date, p_fecha_fin date)
 RETURNS SETOF consumibles LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT * FROM public.consumibles
    WHERE fecha >= p_fecha_inicio AND fecha <= p_fecha_fin
    ORDER BY fecha DESC, id;
END;
$function$;
