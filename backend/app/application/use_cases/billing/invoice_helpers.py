"""Helpers partages entre les use cases de facturation."""

from app.application.dtos.invoice_dto import InvoiceDTO, InvoiceLineDTO
from app.domain.entities.invoice import Invoice, InvoiceLine


def line_entity_to_dto(line: InvoiceLine) -> InvoiceLineDTO:
    return InvoiceLineDTO(
        id=line.id,
        invoice_id=line.invoice_id,
        line_order=line.line_order,
        act_code=line.act_code,
        act_label=line.act_label,
        coefficient=line.coefficient,
        base_rate=line.base_rate,
        quantity=line.quantity,
        line_subtotal=line.line_subtotal,
        supplements=line.supplements,
        supplements_total=line.supplements_total,
        line_total=line.line_total,
        created_at=line.created_at,
    )


def invoice_entity_to_dto(invoice: Invoice) -> InvoiceDTO:
    return InvoiceDTO(
        id=invoice.id,
        cabinet_id=invoice.cabinet_id,
        idel_id=invoice.idel_id,
        patient_id=invoice.patient_id,
        prescription_id=invoice.prescription_id,
        appointment_id=invoice.appointment_id,
        invoice_number=invoice.invoice_number,
        invoice_date=invoice.invoice_date,
        care_date=invoice.care_date,
        total_amo=invoice.total_amo,
        total_amc=invoice.total_amc,
        total_patient=invoice.total_patient,
        total_amount=invoice.total_amount,
        tiers_payant_type=invoice.tiers_payant_type,
        status=invoice.status,
        rejection_reason=invoice.rejection_reason,
        validated_at=invoice.validated_at,
        transmitted_at=invoice.transmitted_at,
        paid_at=invoice.paid_at,
        metadata=invoice.metadata,
        lines=[line_entity_to_dto(l) for l in invoice.lines],
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        payment_date=invoice.payment_date,
        payment_reference=invoice.payment_reference,
        payment_amount=invoice.payment_amount,
        rejection_code=invoice.rejection_code,
        rejected_at=invoice.rejected_at,
        corrected_invoice_id=invoice.corrected_invoice_id,
    )
