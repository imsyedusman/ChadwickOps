![Swagger UI](<Base64-Image-Removed>)swaggerSelect a specWorkguru API V1

## Workguru API  ```  v1  ```

[/swagger/v1/swagger.json](https://api.workguru.io/swagger/v1/swagger.json)

Welcome to the WorkGuru API reference. A guide to getting started can be found [here](https://support.workguru.io/support/solutions/articles/43000713294-workguru-api-authentication-guide).

#### Accounting

GET/api/services/app/Accounting/GetAllTaxRates

GET/api/services/app/Accounting/GetAllTaxRatesWithFilter

GET/api/services/app/Accounting/GetTaxRatesAsDropdownDtoWithOptions

POST/api/services/app/Accounting/ToggleTaxRatesActiveStatus

GET/api/services/app/Accounting/GetAllGlAccountsWithFilter

POST/api/services/app/Accounting/ToggleGlAccountsActiveStatus

GET/api/services/app/Accounting/GetAllLiabilityAccounts

GET/api/services/app/Accounting/GetAllAccounts

GET/api/services/app/Accounting/GetAllRevenueTaxRates

GET/api/services/app/Accounting/GetAllRevenueAccounts

GET/api/services/app/Accounting/GetAllPaymentAccounts

GET/api/services/app/Accounting/GetAllReportingCategories

GET/api/services/app/Accounting/GetCogsJournalByStartDate

POST/api/services/app/Accounting/InsertOrUpdateCogsJournal

POST/api/services/app/Accounting/MakeReportingCategoryActive

POST/api/services/app/Accounting/MakeReportingCategoryInactive

POST/api/services/app/Accounting/MakeReportingCategoryOptionActive

POST/api/services/app/Accounting/MakeReportingCategoryOptionInactive

GET/api/services/app/Accounting/GetAllExpenseAccounts

GET/api/services/app/Accounting/GetAllNonRevenueAccounts

GET/api/services/app/Accounting/GetAllAssetAccounts

GET/api/services/app/Accounting/GetAllGlAccountsByClass

GET/api/services/app/Accounting/GetAllPhaseGlMappings

POST/api/services/app/Accounting/AddOrEditPhaseGlMapping

GET/api/services/app/Accounting/GetAllPhaseGlMappingById

DELETE/api/services/app/Accounting/DeletePhaseGlMapping

POST/api/services/app/Accounting/InsertOrUpdateTaxRate

POST/api/services/app/Accounting/InserOrUpdateTaxRates

POST/api/services/app/Accounting/InsertOrUpdateGlAccount

GET/api/services/app/Accounting/GetCurrentToken

POST/api/services/app/Accounting/InsertOrUpdateGlAccounts

GET/api/services/app/Accounting/GetRecentAccountingSyncErrors

DELETE/api/services/app/Accounting/DeleteAccountingSyncErrors

POST/api/services/app/Accounting/IsAccountingBackgroundSyncEnabled

POST/api/services/app/Accounting/ToggleBackgroundSyncEnabled

GET/api/services/app/Accounting/GetAccountingStatusSnapshot

POST/api/services/app/Accounting/AddOrUpdateAccountingPayrollItems

GET/api/services/app/Accounting/GetAllPayrollItems

GET/api/services/app/Accounting/GetCisLabourGlCode

GET/api/services/app/Accounting/GetCisMaterialsGlCode

#### AccountingPivotReport

GET/api/services/app/AccountingPivotReport/GetCogsLinesInPeriod

GET/api/services/app/AccountingPivotReport/GetRevenueLinesInPeriod

GET/api/services/app/AccountingPivotReport/GetAccountingLinesInPeriod

GET/api/services/app/AccountingPivotReport/GetRevenueForecastInPeriod

#### ApiKeyAuthenticationService

POST/api/services/app/ApiKeyAuthenticationService/Authenticate

#### Asset

POST/api/services/app/Asset/AddOrUpdateAssetAndReturnId

POST/api/services/app/Asset/AddOrUpdateAsset

POST/api/services/app/Asset/AddOrUpdateAssetByName

GET/api/services/app/Asset/GetAllAssetsThatCanBeScheduledAsDropDownDto

GET/api/services/app/Asset/GetAllAssets

GET/api/services/app/Asset/GetAssetById

POST/api/services/app/Asset/SearchAssetsForScheduling

GET/api/services/app/Asset/GetAssetSchedules

POST/api/services/app/Asset/BulkUpdateAssets

POST/api/services/app/Asset/BulkAddOrUpdateAssets

GET/api/services/app/Asset/GetAssetsBySearchTerm

GET/api/services/app/Asset/GetAssetsByClientId

GET/api/services/app/Asset/GetAssetsByFilterClientId

GET/api/services/app/Asset/GetAssetsByFilter

POST/api/services/app/Asset/AddFile

DELETE/api/services/app/Asset/DeleteAssetFileById

GET/api/services/app/Asset/GetPurchaseOrdersByAssetId

GET/api/services/app/Asset/GetAssetFileDtoById

GET/api/services/app/Asset/GetAllAssetsAsDropDownDto

GET/api/services/app/Asset/GetAllAssetsByClientIdAsDropDownDto

GET/api/services/app/Asset/GetAssetByName

POST/api/services/app/Asset/AddNote

DELETE/api/services/app/Asset/DeleteAssetNote

POST/api/services/app/Asset/MarkAsActive

POST/api/services/app/Asset/MarkAsInactive

GET/api/services/app/Asset/GetCountAssetsByPropertyAndValue

#### AssetPivotReport

GET/api/services/app/AssetPivotReport/GetAssetsByCreationDate

GET/api/services/app/AssetPivotReport/GetAssetActivityReportForCurrentAssets

GET/api/services/app/AssetPivotReport/GetAssetProjectProfitSummaryWithinPeriod

#### Client

GET/api/services/app/Client/GetClientNamesAndIds

GET/api/services/app/Client/GetAllClientNamesAndIds

GET/api/services/app/Client/GetClients

GET/api/services/app/Client/GetClientsByFilter

POST/api/services/app/Client/AddOrUpdateClientFromUpload

POST/api/services/app/Client/AddOrUpdateClient

POST/api/services/app/Client/AddOrUpdateClientAndGetId

GET/api/services/app/Client/GetClientList

GET/api/services/app/Client/GetClientListForExport

POST/api/services/app/Client/MergeClients

GET/api/services/app/Client/GetContactListForExport

GET/api/services/app/Client/GetDueDateForInvoice

GET/api/services/app/Client/GetClientsNotSentToAccounting

DELETE/api/services/app/Client/DeletePrice

POST/api/services/app/Client/AddClientProductPrices

GET/api/services/app/Client/GetAllClientProductPrices

GET/api/services/app/Client/GetAllClientProductPricesForReport

GET/api/services/app/Client/GetClientById

GET/api/services/app/Client/GetClientByIdForApp

GET/api/services/app/Client/GetClientByEmail

GET/api/services/app/Client/GetClientByName

GET/api/services/app/Client/GetContactsByClientId

GET/api/services/app/Client/GetContacts

GET/api/services/app/Client/GetNotesByClientId

POST/api/services/app/Client/AddNoteToClient

DELETE/api/services/app/Client/DeleteClientNote

POST/api/services/app/Client/AddFileToClient

GET/api/services/app/Client/GetFileById

POST/api/services/app/Client/AddFile

GET/api/services/app/Client/GetClientFileById

POST/api/services/app/Client/Activate

DELETE/api/services/app/Client/DeleteFile

GET/api/services/app/Client/GetAllClientNotesCreatedAfter

GET/api/services/app/Client/GetInvoicesForClientWhereTheyAreNotTheBillingClient

POST/api/services/app/Client/Inactivate

GET/api/services/app/Client/GetBillingClientForList

GET/api/services/app/Client/GetContactEmailsById

GET/api/services/app/Client/GetAccountBalanceByClientId

POST/api/services/app/Client/CheckIfPoNumberHasBeenUsedByClientBefore

GET/api/services/app/Client/GetClientCurrencyById

POST/api/services/app/Client/AddOrUpdateClientsFromUpload

GET/api/services/app/Client/GetClientsNotSyncedToAccounting

GET/api/services/app/Client/GetClientsByPropertyAndValue

POST/api/services/app/Client/CanSeeClients

#### ClientPivotReport

GET/api/services/app/ClientPivotReport/GetAllActivityLinesInPeriod

GET/api/services/app/ClientPivotReport/GetClientSpecificPricingLinesPivot

GET/api/services/app/ClientPivotReport/GetOpenTransactionsForClient

GET/api/services/app/ClientPivotReport/GetClientDetailPivot

GET/api/services/app/ClientPivotReport/GetOpenTransactionLinesByClient

GET/api/services/app/ClientPivotReport/GetTransactionsForClient

GET/api/services/app/ClientPivotReport/GetTransactionLinesByClient

#### ClientTokenAuth

POST/api/ClientTokenAuth/Authenticate/api/client/v1/tokenauth

#### Contact

POST/api/services/app/Contact/AddOrUpdateContact

POST/api/services/app/Contact/BulkUpdateContacts

GET/api/services/app/Contact/GetAllContacts

GET/api/services/app/Contact/GetContactsByClientId

GET/api/services/app/Contact/GetContactsBySupplierId

GET/api/services/app/Contact/GetContactById

DELETE/api/services/app/Contact/Delete

POST/api/services/app/Contact/AddOrUpdateContactAndGetId

DELETE/api/services/app/Contact/DeleteDuplicateContacts

#### CreditNote

POST/api/services/app/CreditNote/AddOrUpdateClientCreditNote

POST/api/services/app/CreditNote/CreateStockAdjustmentForClientNote

POST/api/services/app/CreditNote/AddOrUpdateSupplierCreditNote

POST/api/services/app/CreditNote/CreateStockAdjustmentForSupplierNote

GET/api/services/app/CreditNote/GetClientCreditNotesNotSentToAccounting

GET/api/services/app/CreditNote/GetClientCreditNotesByProjectId

GET/api/services/app/CreditNote/GetSupplerCreditNotesNotSentToAccounting

GET/api/services/app/CreditNote/GetClientCreditNotesByClientId

GET/api/services/app/CreditNote/GetClientsByFilterClientId

POST/api/services/app/CreditNote/ApproveClientCreditNote

POST/api/services/app/CreditNote/ApproveSupplierCreditNote

DELETE/api/services/app/CreditNote/DeleteClientCreditNote

DELETE/api/services/app/CreditNote/DeleteSupplierCreditNote

GET/api/services/app/CreditNote/GetAllClientCreditNotes

GET/api/services/app/CreditNote/GetAllSupplierCreditNotes

GET/api/services/app/CreditNote/GetAllClientCreditNotesByDateRangeAsDtos

GET/api/services/app/CreditNote/GetAllSupplierCreditNotesByDateRangeAsDtos

GET/api/services/app/CreditNote/GetClientCreditNoteById

GET/api/services/app/CreditNote/GetSupplierCreditNoteById

GET/api/services/app/CreditNote/GetSupplierCreditNotesByPurchaseOrderId

GET/api/services/app/CreditNote/GetClientCreditNotes

GET/api/services/app/CreditNote/GetSupplierCreditNotesByListPurchaseOrderIds

GET/api/services/app/CreditNote/GetSupplierCreditNotes

POST/api/services/app/CreditNote/MarkAsSentToAccounting

POST/api/services/app/CreditNote/UnMarkAsSentToAccounting

POST/api/services/app/CreditNote/MarkAsSentToClient

POST/api/services/app/CreditNote/MarkAsSentToSupplier

POST/api/services/app/CreditNote/AddNote

DELETE/api/services/app/CreditNote/DeleteCreditNoteUserNote

GET/api/services/app/CreditNote/GetClientCreditNotesByProjectGroupId

GET/api/services/app/CreditNote/GetSupplierCreditNotesByProjectGroupId

POST/api/services/app/CreditNote/UploadCreditNoteFile

DELETE/api/services/app/CreditNote/DeleteCreditNoteFile

GET/api/services/app/CreditNote/GetClientCreditNoteFiles

GET/api/services/app/CreditNote/GetSupplierCreditNoteFiles

GET/api/services/app/CreditNote/GetCreditNoteFileById

#### CustomField

POST/api/services/app/CustomField/AddOrEditCustomField

GET/api/services/app/CustomField/GetCustomFieldValuesByIdAndType

POST/api/services/app/CustomField/AddOrEditCustomFieldAndReturnId

GET/api/services/app/CustomField/GetCustomFields

GET/api/services/app/CustomField/GetCustomFieldById

DELETE/api/services/app/CustomField/Delete

GET/api/services/app/CustomField/GetAllCustomFieldDtosByType

GET/api/services/app/CustomField/GetAllCustomFieldsByTypeOrGroupIdAsDto

GET/api/services/app/CustomField/GetAllCustomFieldsByType

GET/api/services/app/CustomField/GetCustomFieldGroupById

POST/api/services/app/CustomField/AddOrEditCustomFieldGroup

GET/api/services/app/CustomField/GetAllCustomFieldGroups

GET/api/services/app/CustomField/GetProjectAndQuoteCustomFieldGroups

GET/api/services/app/CustomField/GetCustomFieldGroupsByTypeAsDropdownDto

DELETE/api/services/app/CustomField/DeleteCustomFieldGroup

GET/api/services/app/CustomField/GetCustomFieldValuesByTypeAndId

#### DeliveryAddress

GET/api/services/app/DeliveryAddress/GetAllDeliveryAddresses

GET/api/services/app/DeliveryAddress/GetDeliveryAddresses

POST/api/services/app/DeliveryAddress/AddOrUpdateDeliveryAddress

POST/api/services/app/DeliveryAddress/AddOrUpdateDeliveryAddAndGetId

DELETE/api/services/app/DeliveryAddress/Delete

GET/api/services/app/DeliveryAddress/GetDeliveryAddressById

GET/api/services/app/DeliveryAddress/GetDeliveryAddressesByName

#### EmploymentHero

GET/api/services/app/EmploymentHero/GetIntegrationTokenForCurrentTenant

POST/api/services/app/EmploymentHero/AddOrUpdateIntegrationToken

POST/api/services/app/EmploymentHero/DestroyAccessToken

POST/api/services/app/EmploymentHero/RefreshAndReturnAccessTokenDto

POST/api/services/app/EmploymentHero/RefreshAccessToken

GET/api/services/app/EmploymentHero/GetBusinesses

POST/api/services/app/EmploymentHero/SetBusinessId

POST/api/services/app/EmploymentHero/SetRegion

GET/api/services/app/EmploymentHero/GetWorkTypes

GET/api/services/app/EmploymentHero/GetUpdatedTimeSheets

POST/api/services/app/EmploymentHero/SyncUsers

POST/api/services/app/EmploymentHero/SyncUserById

GET/api/services/app/EmploymentHero/GetUserForAuthToken

GET/api/services/app/EmploymentHero/GetCurrentBusinessName

POST/api/services/app/EmploymentHero/SendTimesheetsToEmploymentHeroPayroll

GET/api/services/app/EmploymentHero/GetCurrentEmployees

GET/api/services/app/EmploymentHero/GetTimeSheetsNotSentAndMarkAsQueued

GET/api/services/app/EmploymentHero/GetTimesheetsThatFailedSync

GET/api/services/app/EmploymentHero/GetMappedUsers

GET/api/services/app/EmploymentHero/GetAllUsers

GET/api/services/app/EmploymentHero/GetTimesheetsInDateRange

POST/api/services/app/EmploymentHero/SetIntegrationStartDate

POST/api/services/app/EmploymentHero/SetAutoSendTimeSheets

DELETE/api/services/app/EmploymentHero/DeleteExportHistoryFromWorkGuru

GET/api/services/app/EmploymentHero/GetNumberOfUncostedTimeSheets

GET/api/services/app/EmploymentHero/GetNumberOfUnsentTimesheets

GET/api/services/app/EmploymentHero/GetNumberOfUnsyncedUsers

DELETE/api/services/app/EmploymentHero/DeleteExportRow

POST/api/services/app/EmploymentHero/RetryFailedTimesheets

GET/api/services/app/EmploymentHero/GetIndexSnapshot

GET/api/services/app/EmploymentHero/GetTeamsForList

POST/api/services/app/EmploymentHero/ToggleReportingCategoriesEnabled

#### EzzyBills

POST/api/services/app/EzzyBills/UploadReceiptFileAndReturnId

#### Invoice

POST/api/services/app/Invoice/CreateInvoice

POST/api/services/app/Invoice/BulkApproveInvoices

POST/api/services/app/Invoice/ApproveInvoice

GET/api/services/app/Invoice/GetProjectGroupTaskLineItemsByInvoiceId

GET/api/services/app/Invoice/GetProjectGroupProductLineItemsByInvoiceId

GET/api/services/app/Invoice/GetProjectGroupPurchaseLineItemsByInvoiceId

GET/api/services/app/Invoice/GetDraftProjectGroupInvoicesByProjectGroupId

GET/api/services/app/Invoice/GetAllInvoicesSentToAccounting

GET/api/services/app/Invoice/GetAllProjectGroupInvoicesByAssetId

GET/api/services/app/Invoice/GetAllInvoicesByProjectId

GET/api/services/app/Invoice/GetAllInvoicesByProjectGroupId

GET/api/services/app/Invoice/GetAllInvoices

DELETE/api/services/app/Invoice/Delete

POST/api/services/app/Invoice/MarkAsSentToAccounting

POST/api/services/app/Invoice/UnMarkAsSentToAccounting

GET/api/services/app/Invoice/GetInvoiceTimesheetsByInvoiceId

GET/api/services/app/Invoice/GetInvoiceById

GET/api/services/app/Invoice/GetInvoiceToPrint

POST/api/services/app/Invoice/AddOrUpdateInvoice

PUT/api/services/app/Invoice/UpdateInvoice

GET/api/services/app/Invoice/GetInvoicesNotYetSentToAccounting

GET/api/services/app/Invoice/GetUnpaidInvoicesThatHaveBeenSentToAccounting

POST/api/services/app/Invoice/GenerateInvoiceTimesheetsForProjectGroup

POST/api/services/app/Invoice/InvoiceProjectGroup

POST/api/services/app/Invoice/InvoiceStockSale

GET/api/services/app/Invoice/GetProjectGroupInvoicesByProjectId

GET/api/services/app/Invoice/GetInvoices

GET/api/services/app/Invoice/GetInvoicesByClientId

GET/api/services/app/Invoice/GetInvoicesByFilterClientId

GET/api/services/app/Invoice/GetInvoicesByFilter

POST/api/services/app/Invoice/MarkAsSentToClient

GET/api/services/app/Invoice/GetTimeSheetsForInvoice

GET/api/services/app/Invoice/GetInvoicePeriodForInvoice

GET/api/services/app/Invoice/GetInvoiceLinesByProductId

PUT/api/services/app/Invoice/UpdateInvoiceWithNewPoNumber

GET/api/services/app/Invoice/GetDraftInvoices

GET/api/services/app/Invoice/GetAllInvoicesThisMonthForCompletedProjects

PUT/api/services/app/Invoice/UpdateFileName

PUT/api/services/app/Invoice/UpdateFileDescription

POST/api/services/app/Invoice/AddFile

POST/api/services/app/Invoice/InvoiceFileBy

GET/api/services/app/Invoice/GetFileSummaryByInvoiceId

DELETE/api/services/app/Invoice/DeleteInvoiceFile

DELETE/api/services/app/Invoice/DeleteInvoiceNote

POST/api/services/app/Invoice/AddNote

GET/api/services/app/Invoice/GetInvoicesByPropertyAndValue

GET/api/services/app/Invoice/GetInvoiceSummaryById

POST/api/services/app/Invoice/ToggleSendInvoiceFileToAccounting

GET/api/services/app/Invoice/GetAllDisbursementInvoiceLinesByProjectId

#### InvoicePivotReport

GET/api/services/app/InvoicePivotReport/GetInvoicesByDate

GET/api/services/app/InvoicePivotReport/GetInvoiceProductLinesForPivot

GET/api/services/app/InvoicePivotReport/GetInvoiceLinesForPivot

GET/api/services/app/InvoicePivotReport/GetInvoicesThatHaveBeenSentToAccounting

GET/api/services/app/InvoicePivotReport/GetUnpaidInvoices

GET/api/services/app/InvoicePivotReport/GetCreditNotesByDateRange

GET/api/services/app/InvoicePivotReport/GetPaymentsByDatePivot

#### Lead

POST/api/services/app/Lead/ImportLeads

POST/api/services/app/Lead/AddOrUpdateLead

POST/api/services/app/Lead/AddNoteToLead

POST/api/services/app/Lead/MarkLeadAsLost

POST/api/services/app/Lead/MarkLeadAsWon

POST/api/services/app/Lead/SelectQuoteAndWon

POST/api/services/app/Lead/AcceptQuoteAndMarkLeadAsWon

POST/api/services/app/Lead/MarkLeadActivityAsComplete

DELETE/api/services/app/Lead/DeleteLead

DELETE/api/services/app/Lead/DeleteLeadNote

DELETE/api/services/app/Lead/DeleteLeadActivity

GET/api/services/app/Lead/GetLeadById

GET/api/services/app/Lead/GetLeadActivityById

GET/api/services/app/Lead/GetLeadNoteById

GET/api/services/app/Lead/GetLeads

GET/api/services/app/Lead/GetLeadsForChart

GET/api/services/app/Lead/GetLeadIdFromSubjectLine

GET/api/services/app/Lead/GetLeadActivityTypeById

POST/api/services/app/Lead/AddActivityToLead

POST/api/services/app/Lead/BulkAddLeadActivities

POST/api/services/app/Lead/MarkLeadAsCurrent

GET/api/services/app/Lead/GetIncompleteLeadActivityByUserId

GET/api/services/app/Lead/GetAllLeadActivityTypes

POST/api/services/app/Lead/CheckLeadNumber

POST/api/services/app/Lead/AddOrUpdateLeadToDoType

POST/api/services/app/Lead/CompleteLeadActivityInput

POST/api/services/app/Lead/AddOrUpdateLeadCategory

POST/api/services/app/Lead/AddOrUpdateLeadStage

GET/api/services/app/Lead/GetLeadCategoryById

GET/api/services/app/Lead/GetLeadStageById

DELETE/api/services/app/Lead/DeleteLeadCategory

DELETE/api/services/app/Lead/DeleteLeadStage

POST/api/services/app/Lead/InitializeLeadStages

POST/api/services/app/Lead/InitializeLeadCategories

GET/api/services/app/Lead/GetAllLeadCategories

GET/api/services/app/Lead/GetAlLeadStages

GET/api/services/app/Lead/GetAllLeads

GET/api/services/app/Lead/GetAllLeadsForDropdownDto

GET/api/services/app/Lead/GetLeadsByClientId

GET/api/services/app/Lead/GetLeadsByFilterClientId

PUT/api/services/app/Lead/UpdateLeadcategoryFromIndexDropdown

PUT/api/services/app/Lead/UpdateLeadStageFromIndexDropdown

GET/api/services/app/Lead/GetEmailByQuoteIds

POST/api/services/app/Lead/UploadLeadFile

GET/api/services/app/Lead/GetLeadFiles

DELETE/api/services/app/Lead/DeleteLeadFile

GET/api/services/app/Lead/GetLeadFileById

POST/api/services/app/Lead/BulkMarkAsLost

#### LeadForm

GET/api/services/app/LeadForm/GetAll

GET/api/services/app/LeadForm/Get

POST/api/services/app/LeadForm/CreateOrUpdate

DELETE/api/services/app/LeadForm/Delete

#### OnboardingDocumentWizard

POST/api/services/app/OnboardingDocumentWizard/CreateDocumentTemplate

GET/api/services/app/OnboardingDocumentWizard/GetPreview

#### Payment

POST/api/services/app/Payment/AddOrEditPaymentType

GET/api/services/app/Payment/GetAllPaymentTypes

POST/api/services/app/Payment/AddOrUpdatePayment

DELETE/api/services/app/Payment/DeletePayment

GET/api/services/app/Payment/GetAllPaymentsByInvoiceId

GET/api/services/app/Payment/GetAllPayments

GET/api/services/app/Payment/GetPaymentsByFilter

GET/api/services/app/Payment/GetPaymentTypeById

GET/api/services/app/Payment/GetAllPaymentsNotSentToAccounting

GET/api/services/app/Payment/GetAllPaymentsForSyncToAccounting

GET/api/services/app/Payment/GetSupplierDepositsNotSentToAccounting

POST/api/services/app/Payment/BulkAddPayments

POST/api/services/app/Payment/MarkPaymentAsSentToAccounting

POST/api/services/app/Payment/UnMarkPaymentAsSentToAccounting

GET/api/services/app/Payment/GetMostRecentPaymentDate

#### PhaseGlMapping

POST/api/services/app/PhaseGlMapping/CheckTaskForPhaseMapping

POST/api/services/app/PhaseGlMapping/CheckProductForPhaseMapping

GET/api/services/app/PhaseGlMapping/GetGlMappingForPhase

GET/api/services/app/PhaseGlMapping/GetPhaseGlMappingByProjectId

#### PivotReport

POST/api/services/app/PivotReport/AddOrUpdateCustomPivotReport

GET/api/services/app/PivotReport/GetPivotReportById

GET/api/services/app/PivotReport/GetAllCustomPivotReports

DELETE/api/services/app/PivotReport/DeletePivotReport

#### PriceTier

POST/api/services/app/PriceTier/AddOrUpdatePriceTier

GET/api/services/app/PriceTier/GetClientPriceTiers

GET/api/services/app/PriceTier/GetPriceTierById

DELETE/api/services/app/PriceTier/DeletePriceTierById

GET/api/services/app/PriceTier/GetSupplierPriceTiers

GET/api/services/app/PriceTier/GetPriceTiers

#### Product

GET/api/services/app/Product/GetProductById

POST/api/services/app/Product/BulkUpdateBoms

GET/api/services/app/Product/GetProductQnty

POST/api/services/app/Product/AddOrEditProduct

POST/api/services/app/Product/AddOrEditProductByDto

DELETE/api/services/app/Product/DeleteAlternateSupplier

GET/api/services/app/Product/GetProducts

GET/api/services/app/Product/GetWarehouseParLevels

POST/api/services/app/Product/BulkUpdateWarehouseSpecifics

POST/api/services/app/Product/AddOrUpdateProductsFromUpload

POST/api/services/app/Product/AddOrUpdateProductsFromUploadCsv

GET/api/services/app/Product/GetProductBySku

POST/api/services/app/Product/CheckSkuAvailability

POST/api/services/app/Product/AddProductNote

GET/api/services/app/Product/GetListOfProductCategories

GET/api/services/app/Product/GetProductsForPos

PUT/api/services/app/Product/UpdatePricing

GET/api/services/app/Product/GetProductsBySupplier

GET/api/services/app/Product/GetProductsByIdList

GET/api/services/app/Product/GetAllProducts

GET/api/services/app/Product/GetAllFIFOProducts

GET/api/services/app/Product/GetAllProductsForExport

GET/api/services/app/Product/GetAllProductsForExportWithFilters

GET/api/services/app/Product/GetAllProductCategories

GET/api/services/app/Product/GetTooltipSummaryByProductId

POST/api/services/app/Product/SearchProductsWithNamesLike

GET/api/services/app/Product/GetProductsBySearchFilterForStockRelatedTransaction

GET/api/services/app/Product/GetProductsByString

POST/api/services/app/Product/AddFile

GET/api/services/app/Product/GetProductFileById

GET/api/services/app/Product/GetFileSummaryByPropductId

GET/api/services/app/Product/GetProductFileSummariesByListProductIds

GET/api/services/app/Product/GetProductPriceBySupplier

GET/api/services/app/Product/GetProductInformationBySupplierAsSearchResult

GET/api/services/app/Product/GetProductPricedByInputAsSearchResult

DELETE/api/services/app/Product/DeleteProductFile

GET/api/services/app/Product/GetProductsForCount

GET/api/services/app/Product/GetProductListForStockTake

GET/api/services/app/Product/GetProductsForAsset

DELETE/api/services/app/Product/Delete

POST/api/services/app/Product/AddProduct

DELETE/api/services/app/Product/RemoveParentProductFromUomProduct

GET/api/services/app/Product/GetUnitsOfMeasureForProduct

GET/api/services/app/Product/GetBillOfMaterialsForProduct

PUT/api/services/app/Product/UpdateBomComponents

PUT/api/services/app/Product/UpdateUnitsOfMeasure

DELETE/api/services/app/Product/RemoveBomFromNonKitProducts

GET/api/services/app/Product/GetCustomFieldValuesByProductId

#### ProductionJob

GET/api/services/app/ProductionJob/GetProductionJobById

GET/api/services/app/ProductionJob/GetOutputLinesByProdJobId

GET/api/services/app/ProductionJob/GetAllCurrentProductionJobs

GET/api/services/app/ProductionJob/GetAllCurrentProductionJobsWithoutFilter

GET/api/services/app/ProductionJob/GetAllCompletedProjects

GET/api/services/app/ProductionJob/GetAllCurrentProductionJobOutputLines

PUT/api/services/app/ProductionJob/UpdateProductionJob

GET/api/services/app/ProductionJob/GetProductionJobsForProductId

GET/api/services/app/ProductionJob/GetProductionJobsThatUseProduct

GET/api/services/app/ProductionJob/GetComprehensiveProductionInformationByProductId

POST/api/services/app/ProductionJob/CompleteProductionJob

GET/api/services/app/ProductionJob/GetNumberOfCurrentProdJobs

GET/api/services/app/ProductionJob/GetNumberOfOverdueProdJobs

PUT/api/services/app/ProductionJob/UpdateProductionJobDueDate

#### ProductionJobPivotReport

GET/api/services/app/ProductionJobPivotReport/GetCurrentProductionCostSummaryByDate

#### ProductPivotReport

GET/api/services/app/ProductPivotReport/GetOpenOrdersByProduct

GET/api/services/app/ProductPivotReport/GetSerializedProductsUsage

GET/api/services/app/ProductPivotReport/GetProductAndLineItemComparisonReport

#### Project

POST/api/services/app/Project/AddProject

PUT/api/services/app/Project/UpdateProject

PUT/api/services/app/Project/UpdateProjectStatusFromIndexDropdown

PUT/api/services/app/Project/UpdateFileName

PUT/api/services/app/Project/UpdateFileDescription

PUT/api/services/app/Project/UpdateTaskStatusFromIndexDropdown

PUT/api/services/app/Project/UpdateProjectDuedate

GET/api/services/app/Project/GetAllProductsWithSuppliersByProjectId

GET/api/services/app/Project/GetAllCurrentProjectsWithoutFilter

GET/api/services/app/Project/GetAllProjectStatuses

GET/api/services/app/Project/GetAllProductionJobStatuses

GET/api/services/app/Project/GetAllCurrentProjectsByWarehouse

GET/api/services/app/Project/GetProjectIdByNumber

GET/api/services/app/Project/GetProjectNumberById

GET/api/services/app/Project/GetAllProjectsByStartDate

GET/api/services/app/Project/GetAllCurrentProjectSummaries

GET/api/services/app/Project/GetAllCompletedProjectSummaries

GET/api/services/app/Project/GetAllCurrentProjectsForDropDownList

GET/api/services/app/Project/GetAllCurrentProjectsForDashboard

GET/api/services/app/Project/GetAllCurrentProjects

GET/api/services/app/Project/GetAllCompletedProjects

GET/api/services/app/Project/GetPhasesForProject

GET/api/services/app/Project/GetPhasesForProjects

GET/api/services/app/Project/GetAllTimesheetsForProject

GET/api/services/app/Project/GetProjectById

GET/api/services/app/Project/GetProjectByIdForInvoicingAsAtDate

POST/api/services/app/Project/CompleteProject

POST/api/services/app/Project/CompleteProjectForApp

GET/api/services/app/Project/GetProjectNoteFromEmail

GET/api/services/app/Project/GetProjectIdFromEmailSubject

GET/api/services/app/Project/GetProjectSummaryByQuoteId

POST/api/services/app/Project/AddNote

GET/api/services/app/Project/GetProjectsWithoutProjectGroups

GET/api/services/app/Project/GetProjectsWithProducts

DELETE/api/services/app/Project/DeleteAsync

POST/api/services/app/Project/AddProductToProject

POST/api/services/app/Project/AddFile

GET/api/services/app/Project/GetFilesForProject

GET/api/services/app/Project/GetProjectFileById

GET/api/services/app/Project/GetAllUsersByProjectId

GET/api/services/app/Project/GetAllTasksTodosByProjectId

GET/api/services/app/Project/GetAllTasksByProjectId

GET/api/services/app/Project/GetAllTasksByProjectIdForDropdown

GET/api/services/app/Project/GetAllTasksByProjectIdForDropdownWithStatusFilter

GET/api/services/app/Project/GetAllTasksByProjectIdForTimesheetsDropdown

GET/api/services/app/Project/GetAllTasksByProjectIdUserId

GET/api/services/app/Project/GetTimesheetTasksByProjectIdUserId

GET/api/services/app/Project/GetTimesheetTasksByProjectIdUserIdForDropdown

GET/api/services/app/Project/GetTimesheetTasksByProjectIdUserIdForDropdownWithStatusFilter

GET/api/services/app/Project/GetCurrentTasksByProjectId

GET/api/services/app/Project/GetCurrentTasksByProjectIdUserId

GET/api/services/app/Project/GetAllProductsByProjectId

POST/api/services/app/Project/CheckIfProjectUsesProduct

GET/api/services/app/Project/GetAllProjectsByUserId

GET/api/services/app/Project/GetCurrentProjectsForDropDownByUserId

GET/api/services/app/Project/GetCurrentProjectsByUserId

GET/api/services/app/Project/GetProjectTaskLineById

POST/api/services/app/Project/MarkProjectAsIncomplete

POST/api/services/app/Project/ToggleMarkProjectAsUsingStaffRates

GET/api/services/app/Project/GetCurrentProjectsByProjectManagerId

GET/api/services/app/Project/GetAllProjectsByProjectManagerId

POST/api/services/app/Project/MarkTaskAsComplete

POST/api/services/app/Project/MarkTaskAsCompleteForApp

POST/api/services/app/Project/BulkMarkTasksAsComplete

POST/api/services/app/Project/BulkMarkTasksAsIncomplete

POST/api/services/app/Project/MarkTaskAsIncomplete

GET/api/services/app/Project/GetStockUsageLinesForProjectId

POST/api/services/app/Project/UseAllRemainingMaterials

GET/api/services/app/Project/GetProjectsByRecurringProjectId

GET/api/services/app/Project/GetAllCurrentTasks

GET/api/services/app/Project/GetAllTasks

GET/api/services/app/Project/GetAllTasksForStaffBoard

POST/api/services/app/Project/CreateTemplateFromProjectId

GET/api/services/app/Project/GetProjectSummaryByProjectId

GET/api/services/app/Project/GetProjectSummaryDtoById

DELETE/api/services/app/Project/DeleteProjectNote

DELETE/api/services/app/Project/DeleteProjectFile

DELETE/api/services/app/Project/DeleteProjectEmailFileById

DELETE/api/services/app/Project/DeleteProjectEmailById

GET/api/services/app/Project/GetProjectsForProjectSchedule

GET/api/services/app/Project/GetProjectsBetweenDates

PUT/api/services/app/Project/UpdateProjectSchedule

POST/api/services/app/Project/ScheduleUnscheduledTasksForCurrentProjects

POST/api/services/app/Project/ImportProjectLines

GET/api/services/app/Project/GetProjectsByClientId

GET/api/services/app/Project/GetProjectsByFilterClientId

GET/api/services/app/Project/GetProjectsByAssetId

GET/api/services/app/Project/GetNumberOfCurrentProjects

GET/api/services/app/Project/GetAllCurrentProjectsNotInvoiced

GET/api/services/app/Project/GetNumberOfOverdueProjects

GET/api/services/app/Project/GetNumberOfProjectsDueThisWeek

GET/api/services/app/Project/GetNumberOfNewProjects

GET/api/services/app/Project/GetAllProjects

GET/api/services/app/Project/GetAllProjectsInlcudingProductionJobs

GET/api/services/app/Project/GetEmailsForProject

GET/api/services/app/Project/GetListFifoProductIdsFromListProjectLineItemIds

PUT/api/services/app/Project/UpdateCompletionTime

GET/api/services/app/Project/GetProjectProductsByIdForMobile

POST/api/services/app/Project/CanSeePurchases

POST/api/services/app/Project/CanSeeProjects

POST/api/services/app/Project/CanSeeTimeSheets

POST/api/services/app/Project/CanUserCompleteProject

POST/api/services/app/Project/CanAddTasksToAll

POST/api/services/app/Project/CanAddStockUsage

POST/api/services/app/Project/CanFillTheForm

POST/api/services/app/Project/CanAddPurchaseOrder

POST/api/services/app/Project/CanApprovePurchaseOrder

POST/api/services/app/Project/CanAddProduct

GET/api/services/app/Project/GetAllCurrentProjectsWidgetOverview

POST/api/services/app/Project/IsFeatureDependencyTrue

POST/api/services/app/Project/HasProjectNumberBeenUsed

GET/api/services/app/Project/GetAllCurrentProjectsByWarehouseForMobile

GET/api/services/app/Project/GetProjectSummaryByIdForMob

GET/api/services/app/Project/GetProjectNoteByIdForMob

GET/api/services/app/Project/GetProjectsForMobileAppWithFilter

GET/api/services/app/Project/GetAllTasksByProjectIdForApp

GET/api/services/app/Project/GetAllTasksByProjectIdForAppWithStatusFilter

GET/api/services/app/Project/GetProjectsForMobileApp

GET/api/services/app/Project/GetProjectsForMobileAppWithStatusFilter

POST/api/services/app/Project/CanUserSeeStock

POST/api/services/app/Project/CanUserRecievePo

POST/api/services/app/Project/CanUserSeeStockSales

POST/api/services/app/Project/CanUserSeePos

GET/api/services/app/Project/GetLatestversion

#### ProjectGroup

GET/api/services/app/ProjectGroup/GetAllProjectGroups

POST/api/services/app/ProjectGroup/AddOrEditProjectGroup

POST/api/services/app/ProjectGroup/MarkAsComplete

POST/api/services/app/ProjectGroup/MarkAsIncomplete

GET/api/services/app/ProjectGroup/GetProjectGroupByName

GET/api/services/app/ProjectGroup/GetPRojectIdsByProjectGroupId

POST/api/services/app/ProjectGroup/CheckCanVariationQuoteBeCreatedForExistingProjectGroup

GET/api/services/app/ProjectGroup/GetProjectIdsByForClientInProjectGroup

GET/api/services/app/ProjectGroup/GetClientsInProjectGroup

GET/api/services/app/ProjectGroup/GetTasksInProjectGroupByClientId

GET/api/services/app/ProjectGroup/GetProductsInProjectGroupByClientId

GET/api/services/app/ProjectGroup/GetPurchaseOrderLinesInProjectGroupByClientId

GET/api/services/app/ProjectGroup/GetUnrelatedProjectGroupDropDownList

GET/api/services/app/ProjectGroup/GetProjectGroupById

POST/api/services/app/ProjectGroup/AddOrUpdateProjectGroup

POST/api/services/app/ProjectGroup/CreateProjectGroupWithProjectsForEachAssetFromTemplate

GET/api/services/app/ProjectGroup/GetProjectGroupDropDownList

GET/api/services/app/ProjectGroup/GetProjectGroups

GET/api/services/app/ProjectGroup/GetFilesForAllProjectsInProjectGroup

GET/api/services/app/ProjectGroup/GetEmailsForAllProjectsInProjectGroup

#### ProjectPivotReport

GET/api/services/app/ProjectPivotReport/GetFormCompletions

GET/api/services/app/ProjectPivotReport/GetProjectProfitSummary

GET/api/services/app/ProjectPivotReport/GetProjectProfitSummaryWithinPeriod

GET/api/services/app/ProjectPivotReport/GetAllCurrentProjectsDueInDateRange

GET/api/services/app/ProjectPivotReport/GetAllProjectsCompletedInDateRange

GET/api/services/app/ProjectPivotReport/GetAllProjectSummariesStartingDueOrCompletedBeforeDate

GET/api/services/app/ProjectPivotReport/GetAllQuotedProjectSummariesByCreationDate

GET/api/services/app/ProjectPivotReport/GetEstimatedBillingsByLine

GET/api/services/app/ProjectPivotReport/GetRevenueForecastBasedOnQuoted

GET/api/services/app/ProjectPivotReport/GetProjectValueAndInvoicedByStartDate

GET/api/services/app/ProjectPivotReport/GetProjectValueAndInvoicedByDueDate

GET/api/services/app/ProjectPivotReport/GetProjectTaskPivotLineItemByProjectStartDate

GET/api/services/app/ProjectPivotReport/GetProjectTaskPivotLineItemByProjectDueDate

GET/api/services/app/ProjectPivotReport/GetProjectProductPivotLineItemByProjectStartDate

GET/api/services/app/ProjectPivotReport/GetCurrentProjectTaskPivotLineItemByProjectStartDate

GET/api/services/app/ProjectPivotReport/GetCurrentProjectTaskPivotLineItemByProjectDueDate

GET/api/services/app/ProjectPivotReport/GetProjectProgressSummary

GET/api/services/app/ProjectPivotReport/GetProjectForecastVsActualsPivot

GET/api/services/app/ProjectPivotReport/GetProjectForecastVsActualsGroupedPivot

GET/api/services/app/ProjectPivotReport/GetProdJobForecastVsActualsPivot

GET/api/services/app/ProjectPivotReport/GetProdJobForecastVsActualsGroupedPivot

GET/api/services/app/ProjectPivotReport/GetProductionJobOutputLinesPivot

GET/api/services/app/ProjectPivotReport/GetProjectActivityLinesPivot

GET/api/services/app/ProjectPivotReport/GetProjectNotesReport

GET/api/services/app/ProjectPivotReport/GetWipBasedOnActualsNew

GET/api/services/app/ProjectPivotReport/GetWipBasedOnQuotedNew

#### ProjectTemplate

POST/api/services/app/ProjectTemplate/DuplicateProjectTemplate

GET/api/services/app/ProjectTemplate/GetTemplateByName

POST/api/services/app/ProjectTemplate/RecostTemplate

POST/api/services/app/ProjectTemplate/RecostTemplates

POST/api/services/app/ProjectTemplate/AddOrEditProjectTemplate

POST/api/services/app/ProjectTemplate/AddOrEditProjectTemplateAndReturnId

POST/api/services/app/ProjectTemplate/SaveAndContinue

GET/api/services/app/ProjectTemplate/GetProjectTemplatesForDropDownList

GET/api/services/app/ProjectTemplate/GetAllProjectTemplates

GET/api/services/app/ProjectTemplate/GetTemplateById

DELETE/api/services/app/ProjectTemplate/DeleteProjectTemplate

GET/api/services/app/ProjectTemplate/GetProjectTemplates

GET/api/services/app/ProjectTemplate/GetAllProductionJobTemplates

GET/api/services/app/ProjectTemplate/GetAllProductionJobTemplatesByProductId

GET/api/services/app/ProjectTemplate/GetProductionTemplatesForListOutputProductIds

POST/api/services/app/ProjectTemplate/BulkAddProjects

#### ProjectTemplatePivotReport

GET/api/services/app/ProjectTemplatePivotReport/GetAllProjectTemplateSummaries

GET/api/services/app/ProjectTemplatePivotReport/GetAllProjectTemplateLineItems

#### PurchaseOrder

PUT/api/services/app/PurchaseOrder/UpdatePurchaseOrderInvoiceDetails

GET/api/services/app/PurchaseOrder/GetPOsByFilterClientId

GET/api/services/app/PurchaseOrder/GetAllPurchaseOrdersSentToAccounting

POST/api/services/app/PurchaseOrder/MarkAsSentToAccounting

POST/api/services/app/PurchaseOrder/UnMarkAsSentToAccounting

POST/api/services/app/PurchaseOrder/ApprovePurchaseOrder

POST/api/services/app/PurchaseOrder/MarkAsSentToSupplier

POST/api/services/app/PurchaseOrder/UnMarkAsSentToSupplier

POST/api/services/app/PurchaseOrder/MarkAsBillable

POST/api/services/app/PurchaseOrder/MarkAsNotBillable

PUT/api/services/app/PurchaseOrder/UpdateFileName

PUT/api/services/app/PurchaseOrder/UpdateFileDescription

POST/api/services/app/PurchaseOrder/AddNote

GET/api/services/app/PurchaseOrder/GetAllStockPurchasesInDateRangeWithDifferentReceivedAndInvoicedDates

DELETE/api/services/app/PurchaseOrder/DeletePoFile

DELETE/api/services/app/PurchaseOrder/DeletePurchaseOrderNote

POST/api/services/app/PurchaseOrder/AddOrEditPurchaseOrder

POST/api/services/app/PurchaseOrder/MergePurchaseOrder

GET/api/services/app/PurchaseOrder/GetPOsForProductId

PUT/api/services/app/PurchaseOrder/UpdatePurchaseOrder

GET/api/services/app/PurchaseOrder/GetAllReceivedPurchaseOrdersThatAreNotLandedCostPOs

GET/api/services/app/PurchaseOrder/GetAllStockPurchaseOrdersForLandedCostAttribution

GET/api/services/app/PurchaseOrder/GetIncomingStock

GET/api/services/app/PurchaseOrder/GetAllPurchaseOrdersRelatedToPo

POST/api/services/app/PurchaseOrder/AddFile

POST/api/services/app/PurchaseOrder/PurchaseOrderFileBy

POST/api/services/app/PurchaseOrder/ReceivePurchaseOrder

POST/api/services/app/PurchaseOrder/CreateBackOrderByPoId

POST/api/services/app/PurchaseOrder/CreateBackOrder

GET/api/services/app/PurchaseOrder/GetInvoicedPurchaseOrdersNotSentToAccounting

GET/api/services/app/PurchaseOrder/GetAllPurchaseOrders

GET/api/services/app/PurchaseOrder/GetAllProjectPurchaseOrders

GET/api/services/app/PurchaseOrder/GetPurchaseOrderById

GET/api/services/app/PurchaseOrder/GetPurchaseOrderBasicById

GET/api/services/app/PurchaseOrder/GetFileSummaryByPurchaseOrderId

GET/api/services/app/PurchaseOrder/GetFileInfoForDataTableByPurchaseOrderId

GET/api/services/app/PurchaseOrder/GetFileCountByPurchaseOrderId

GET/api/services/app/PurchaseOrder/GetUnpaidPurchaseOrdersThatHaveBeenSentToAccounting

GET/api/services/app/PurchaseOrder/GetValueOfPurchasesRaisedInPeriod

GET/api/services/app/PurchaseOrder/GetNumberOfOpenPurchaseOrders

GET/api/services/app/PurchaseOrder/GetNumberOfDraftPurchaseOrders

GET/api/services/app/PurchaseOrder/GetPurchasesRaisedInPeriod

GET/api/services/app/PurchaseOrder/GetPurchasesInvoicedInPeriod

GET/api/services/app/PurchaseOrder/GetAllExpensePurchasesByClientId

GET/api/services/app/PurchaseOrder/GetAdvancedPurchasesForStockSaleId

GET/api/services/app/PurchaseOrder/GetAdvancedPurchasesCountForStockSaleId

POST/api/services/app/PurchaseOrder/ValidatePurchaseOrderBeforeDelete

GET/api/services/app/PurchaseOrder/GetMergedPurchaseOrdersByPostMergePoId

GET/api/services/app/PurchaseOrder/GetAllDraftPurchaseOrders

PUT/api/services/app/PurchaseOrder/UpdatePurchaseOrderExpectedDate

GET/api/services/app/PurchaseOrder/GetValueOfPurchaseOrdersReceivedNotInvoiced

GET/api/services/app/PurchaseOrder/GetCountOfPurchaseOrdersReceivedNotInvoiced

GET/api/services/app/PurchaseOrder/GetValueOfPurchaseOrdersInvoicedNotReceived

GET/api/services/app/PurchaseOrder/GetCountOfPurchaseOrdersInvoicedNotReceived

GET/api/services/app/PurchaseOrder/GetNumberOfOpenPOs

GET/api/services/app/PurchaseOrder/GetValueOfOpenPOs

GET/api/services/app/PurchaseOrder/GetPurchaseOrdersForDropDown

GET/api/services/app/PurchaseOrder/GetEmailFilesForPurchaseOrder

GET/api/services/app/PurchaseOrder/GetPurchaseOrders

GET/api/services/app/PurchaseOrder/GetPurchaseOrdersForKioskApp

GET/api/services/app/PurchaseOrder/GetPurchaseOrdersForMergePoModal

POST/api/services/app/PurchaseOrder/CancelPurchaseOrder

GET/api/services/app/PurchaseOrder/GetPurchaseOrdersForMob

GET/api/services/app/PurchaseOrder/GetPurchaseOrderByIdForMob

GET/api/services/app/PurchaseOrder/GetdefaultPurchaseTax

GET/api/services/app/PurchaseOrder/GetAllPurchaseOrdersAsDto

GET/api/services/app/PurchaseOrder/GetSettingsForMobile

GET/api/services/app/PurchaseOrder/GetSupplierIdByPurchaseOrderId

GET/api/services/app/PurchaseOrder/GetWarehouseIdByPurchaseOrderId

POST/api/services/app/PurchaseOrder/ToggleSendPurchaseOrderFileToAccounting

#### PurchasesPivotReport

GET/api/services/app/PurchasesPivotReport/GetPurchaseLinesByInvoiceDateForPivot

GET/api/services/app/PurchasesPivotReport/GetPurchaseLinesByReceivedDateForPivot

GET/api/services/app/PurchasesPivotReport/GetPurchaseLinesForPivot

GET/api/services/app/PurchasesPivotReport/GetPurchaseOrderSummariesByIssueDate

GET/api/services/app/PurchasesPivotReport/GetPurchaseOrderSummariesBySentToAccountingDate

GET/api/services/app/PurchasesPivotReport/GetPurchaseOrderSummariesByInvoiceDate

GET/api/services/app/PurchasesPivotReport/GetPurchaseOrderSummariesByReceivedDate

GET/api/services/app/PurchasesPivotReport/GetPurchasesAndAccountingPotentialDiscrepanciesReport

GET/api/services/app/PurchasesPivotReport/GetPurchaseOrderSummariesByExpectedDate

GET/api/services/app/PurchasesPivotReport/GetExpectedProfitOnReceivedGoodsPivot

GET/api/services/app/PurchasesPivotReport/GetUnpaidPurchaseOrders

#### Qbo

POST/api/services/app/Qbo/SaveToken

GET/api/services/app/Qbo/GetToken

POST/api/services/app/Qbo/DestroyToken

POST/api/services/app/Qbo/QuickBookOnboarding

GET/api/services/app/Qbo/GetTaxRates

GET/api/services/app/Qbo/GetChartOfAccounts

#### QuotePivotReport

GET/api/services/app/QuotePivotReport/QuoteToInvoiceReportByQuoteWonDate

GET/api/services/app/QuotePivotReport/GetQuoteSummariesByCreationDate

GET/api/services/app/QuotePivotReport/GetQuoteSummariesByExpiryDate

GET/api/services/app/QuotePivotReport/GetQuoteSummariesByForecastDate

GET/api/services/app/QuotePivotReport/GetQuoteSummariesByQuoteDate

GET/api/services/app/QuotePivotReport/GetQuoteLinesPivot

GET/api/services/app/QuotePivotReport/GetQuoteSummariesByQuotesWonOrDeclinedDate

#### RecurringProjectPivotReport

GET/api/services/app/RecurringProjectPivotReport/GetRecurringProjectLinesRecurringProjectEndDate

GET/api/services/app/RecurringProjectPivotReport/GetRecurringProjectsAndInvoicedValueinRange

GET/api/services/app/RecurringProjectPivotReport/GetRecurringProjectsForecastAndActualValueSummariesInRange

#### SalesPivotReport

GET/api/services/app/SalesPivotReport/GetLeadActivitiesByDueDate

GET/api/services/app/SalesPivotReport/GetLeadActivitiesByCompletedDate

GET/api/services/app/SalesPivotReport/GetLeadSummariesByCreationDate

GET/api/services/app/SalesPivotReport/GetLeadSummariesByForecastDate

GET/api/services/app/SalesPivotReport/GetStockSaleLineItemsPivot

GET/api/services/app/SalesPivotReport/GetStockSaleSummariesByDispatchDate

GET/api/services/app/SalesPivotReport/GetStockSaleSummariesByIssueDate

GET/api/services/app/SalesPivotReport/GetStockSaleSummariesByExpectedDate

GET/api/services/app/SalesPivotReport/GetStockSaleProductProfitInPeriodPivot

#### ScheduleBlock

POST/api/services/app/ScheduleBlock/SaveBatchAsync

GET/api/services/app/ScheduleBlock/GetBlocksInRangeAsync

DELETE/api/services/app/ScheduleBlock/DeleteBlockAsync

DELETE/api/services/app/ScheduleBlock/DeleteBlocksByTaskAsync

#### Scheduling

POST/api/services/app/Scheduling/AddOrUpdateTaskScheduleAndGetId

DELETE/api/services/app/Scheduling/DeleteTaskSchedule

GET/api/services/app/Scheduling/GetSchedulesInRange

#### SchedulingResource

GET/api/services/app/SchedulingResource/GetAsync

GET/api/services/app/SchedulingResource/GetAllAsync

POST/api/services/app/SchedulingResource/CreateAsync

PUT/api/services/app/SchedulingResource/UpdateAsync

DELETE/api/services/app/SchedulingResource/DeleteAsync

GET/api/services/app/SchedulingResource/GetActiveResourcesAsync

#### Session

PUT/api/services/app/Session/UpdateUserSignInToken

#### Stock

POST/api/services/app/Stock/AddStockTake

GET/api/services/app/Stock/GetStockTakeList

POST/api/services/app/Stock/DownloadStockTakeFile

GET/api/services/app/Stock/GetStockLevelsForWarehouse

POST/api/services/app/Stock/CheckSerialsForDuplicateInProductIdAndReturnDuplicates

GET/api/services/app/Stock/GetSerialNumbersByProductIdInWarehouse

GET/api/services/app/Stock/GetBatchAndSerialStockAvailability

GET/api/services/app/Stock/GetBatchStockLevelByWarehouse

GET/api/services/app/Stock/GetAllStockLevels

GET/api/services/app/Stock/GetPotentialStockShortagesReport

GET/api/services/app/Stock/GetStockDemandForStockReport

GET/api/services/app/Stock/GetStockDemandByEndDate

GET/api/services/app/Stock/GetStockMovementsForStockAdjustmentsJournal

GET/api/services/app/Stock/GetStockTakesNotSentToAccounting

GET/api/services/app/Stock/GetStockAdjustmentsNotSentToAccounting

POST/api/services/app/Stock/MarkStockTakeAsSentToAccounting

POST/api/services/app/Stock/MarkStockAdjustmentAsSentToAccounting

GET/api/services/app/Stock/GetStockMovementsForStockTake

GET/api/services/app/Stock/GetStockMovementsForStockAdjustment

GET/api/services/app/Stock/GetStockMovementsForCogsJournalUsingHistoricalMethod

GET/api/services/app/Stock/GetStockUsageNotSentToAccounting

POST/api/services/app/Stock/MarkStockTakeAsUnsentToAccounting

POST/api/services/app/Stock/MarkStockAdjustmentAsUnsentToAccounting

GET/api/services/app/Stock/GetStockMovementsForCogsWithoutCategoriesReport

POST/api/services/app/Stock/AddStockUsage

POST/api/services/app/Stock/AddMultipleStockUsage

GET/api/services/app/Stock/GetStockLevelByProductId

POST/api/services/app/Stock/AddStockCountsByUpload

POST/api/services/app/Stock/RecostPurchaseOrder

GET/api/services/app/Stock/GetStockMovementById

GET/api/services/app/Stock/GetStockMovementByTenantIdMovementId

POST/api/services/app/Stock/ReverseStockUsage

GET/api/services/app/Stock/GetStockMovements

GET/api/services/app/Stock/GetStockTransfers

GET/api/services/app/Stock/GetStockUsageByAssetId

GET/api/services/app/Stock/GetStockMovementsByProductId

POST/api/services/app/Stock/CheckNumberOfSerialOrBatchProductInStock

GET/api/services/app/Stock/GetQuantityOfProductUsedAlready

GET/api/services/app/Stock/GetproductsToReorder

GET/api/services/app/Stock/GetStockUsageByProjectGroup

POST/api/services/app/Stock/AddStockAdjustment

GET/api/services/app/Stock/GetStockAdjustments

POST/api/services/app/Stock/RecostStockTake

POST/api/services/app/Stock/RecostStockMovementsByProductId

POST/api/services/app/Stock/RecostAllStockMovementsByProduct

GET/api/services/app/Stock/GetAllStockMovementsToDate

POST/api/services/app/Stock/RecostStockTransfer

GET/api/services/app/Stock/GetAllStockLevelsByWarehouseId

GET/api/services/app/Stock/GetCurrentStockLevelsByListProductIds

GET/api/services/app/Stock/GetStockValueByWarehouseId

GET/api/services/app/Stock/GetAllStockUsageByProductId

GET/api/services/app/Stock/GetCurrentStockLevelsNew2

GET/api/services/app/Stock/GetIncomingForProductIds

GET/api/services/app/Stock/GetCurrentStockLevels

GET/api/services/app/Stock/GetAllStockUsageInDateRage

GET/api/services/app/Stock/GetStockTransferById

POST/api/services/app/Stock/AddOrUpdateStockTransfer

GET/api/services/app/Stock/GetTotalStockOnHand

GET/api/services/app/Stock/GetAllProjectStockUsageInDateRange

GET/api/services/app/Stock/GetStockMovementsForStockSaleById

GET/api/services/app/Stock/GetIncomingAndCommittedStockByProductId

GET/api/services/app/Stock/GetStockUsageByProjectId

#### StockPivotReport

GET/api/services/app/StockPivotReport/GetStockMovementsByDate

GET/api/services/app/StockPivotReport/GetStockValueByProductAtDate

GET/api/services/app/StockPivotReport/GetStockDemandByDateAndTransaction

GET/api/services/app/StockPivotReport/GetCogsLinesByDate

GET/api/services/app/StockPivotReport/GetStockUsedInPeriod

GET/api/services/app/StockPivotReport/GetStockDemandByDate

GET/api/services/app/StockPivotReport/GetSerialBatchAvailabilityReport

#### StockSale

GET/api/services/app/StockSale/GetStockSaleById

GET/api/services/app/StockSale/GetRelatedPurchasesForStockSale

GET/api/services/app/StockSale/GetRelatedPurchasesCount

GET/api/services/app/StockSale/GetStockSaleByIdOld

GET/api/services/app/StockSale/GetStockSaleSummaryByQuoteId

GET/api/services/app/StockSale/GetCurrentStockSalesByOwnerId

PUT/api/services/app/StockSale/UpdateFileName

PUT/api/services/app/StockSale/UpdateFileDescription

POST/api/services/app/StockSale/AddOrEditStockSale

POST/api/services/app/StockSale/DispatchStockSale

POST/api/services/app/StockSale/MarkStockSaleDispatched

POST/api/services/app/StockSale/PartiallyDispatchStockSale

POST/api/services/app/StockSale/PartiallyDispatchStockSaleTestForMob

POST/api/services/app/StockSale/MarkStockSaleDispatchedAndCreateBackorder

POST/api/services/app/StockSale/ApproveStockSale

POST/api/services/app/StockSale/InvoiceStockSale

POST/api/services/app/StockSale/CompleteStockSale

GET/api/services/app/StockSale/GetStockSales

GET/api/services/app/StockSale/GetNumberOfOpenStockSales

GET/api/services/app/StockSale/GetAllStockSales

GET/api/services/app/StockSale/GetStockSalesByClientId

GET/api/services/app/StockSale/GetStockSaleSummariesByFilterAndClientId

GET/api/services/app/StockSale/GetStockSalesForProductId

POST/api/services/app/StockSale/RevertToDraft

POST/api/services/app/StockSale/AddNote

DELETE/api/services/app/StockSale/DeleteStockSaleEmailAndAttachedFilesByEmailId

DELETE/api/services/app/StockSale/DeleteStockSaleEmailFileById

DELETE/api/services/app/StockSale/DeleteNote

POST/api/services/app/StockSale/InvoiceStockSaleAndApprove

GET/api/services/app/StockSale/GetAllStockSalesInDateRange

GET/api/services/app/StockSale/GetAllStockSalesInvoicedInDateRange

GET/api/services/app/StockSale/GetEmailsAndAttachedFilesByStockSaleId

POST/api/services/app/StockSale/AddFile

DELETE/api/services/app/StockSale/DeleteStockSaleFile

GET/api/services/app/StockSale/GetStockSaleFileDtoById

GET/api/services/app/StockSale/GetFilesByStockSaleId

POST/api/services/app/StockSale/ToggleStockSaleLineItemBillable

PUT/api/services/app/StockSale/UpdateClientPurchaseOrder

#### StockTransfer

POST/api/services/app/StockTransfer/DispatchStockTransferFromInput

POST/api/services/app/StockTransfer/ReceiveStockTransferIntoDestination

#### Supplier

GET/api/services/app/Supplier/GetAllSuppliers

GET/api/services/app/Supplier/GetSuppliersForDropDown

GET/api/services/app/Supplier/GetAllActiveSuppliers

POST/api/services/app/Supplier/AddOrUpdateSupplier

POST/api/services/app/Supplier/AddOrUpdateSupplierByDto

POST/api/services/app/Supplier/AddOrUpdateSupplierAndGetId

POST/api/services/app/Supplier/SupplierHasPo

POST/api/services/app/Supplier/CanSupplierBeDeleted

GET/api/services/app/Supplier/GetSuppliersNotSentToAccounting

GET/api/services/app/Supplier/GetSupplierById

GET/api/services/app/Supplier/GetSupplierTaxRateBySupplierId

GET/api/services/app/Supplier/GetEstimateLeadTimeBySupplierId

GET/api/services/app/Supplier/GetSupplierCustomfilds

POST/api/services/app/Supplier/BulkUpdateSuppliers

GET/api/services/app/Supplier/GetSuppliers

GET/api/services/app/Supplier/GetSupplierByName

GET/api/services/app/Supplier/GetContactListForExport

GET/api/services/app/Supplier/GetAccountBalanceBySupplierId

GET/api/services/app/Supplier/GetContactEmailsById

POST/api/services/app/Supplier/AddFileToSupplierAndGetId

DELETE/api/services/app/Supplier/DeleteSupplierFileById

GET/api/services/app/Supplier/GetFileSummariesBySupplierId

GET/api/services/app/Supplier/GetSupplierFileById

POST/api/services/app/Supplier/CheckIfSupplierInvoiceNumberHasBeenUsedBySupplierBefore

GET/api/services/app/Supplier/GetSupplierCurrencyById

GET/api/services/app/Supplier/GetDueDateStringFromSupplierAndInvoiceDate

#### Task

POST/api/services/app/Task/AddOrEditTask

POST/api/services/app/Task/AddOrUpdateTasksFromUpload

GET/api/services/app/Task/GetCurrentTasksForStatusChangePage

PUT/api/services/app/Task/UpdateTasksWithStatus

POST/api/services/app/Task/BulkAddorUpdatetasksFromUpload

DELETE/api/services/app/Task/DeleteTask

GET/api/services/app/Task/GetAllTasks

GET/api/services/app/Task/GetAllTasksForExport

POST/api/services/app/Task/SearchTasksWithNamesLike

GET/api/services/app/Task/GetTaskById

POST/api/services/app/Task/AddOrUpdateTasks

GET/api/services/app/Task/GetAllTasksByUserId

GET/api/services/app/Task/GetAllTasksByUserIdForApp

GET/api/services/app/Task/GetAllTasksByStatusForProductionTaskBoard

POST/api/services/app/Task/IsNameExist

GET/api/services/app/Task/GetAllTasksCompletedInDateRange

GET/api/services/app/Task/GetAllInCompletedTasksInDateRange

PUT/api/services/app/Task/UpdateUserForTaskOnStaffDashboard

PUT/api/services/app/Task/UpdateHoursForTaskOnStaffDashboard

GET/api/services/app/Task/GetTasks

GET/api/services/app/Task/GetTaskIdByNameAndProjectId

GET/api/services/app/Task/GetAllTasksForCompletedProjects

GET/api/services/app/Task/GetAllTasksForCurrentProjects

GET/api/services/app/Task/GetAllTasksForProjectTaskBoard

GET/api/services/app/Task/GetQuoteTaskLineItemsByQuoteIdWithoutRelation

GET/api/services/app/Task/GetAllTasksByProjectId

GET/api/services/app/Task/GetAllTasksBetweenDates

PUT/api/services/app/Task/UpdateTaskSchedule

PUT/api/services/app/Task/UpdateUserForTask

GET/api/services/app/Task/GetCustomFieldValuesByTaskId

GET/api/services/app/Task/GetAllTaskStatuses

GET/api/services/app/Task/GetTaskPricedByInputAsSearchResult

#### Team

POST/api/services/app/Team/AddOrEdit

DELETE/api/services/app/Team/DeleteTeam

GET/api/services/app/Team/GetAllTeams

GET/api/services/app/Team/GetAllTeamsList

GET/api/services/app/Team/GetTeamsForDropdown

GET/api/services/app/Team/GetTeamById

POST/api/services/app/Team/AddOrUpdateTeamAndGetId

#### TimeSheet

GET/api/services/app/TimeSheet/GetAllTimeSheetsInDateRangeWithPayrollId

POST/api/services/app/TimeSheet/AddOrUpdateTimeSheet

POST/api/services/app/TimeSheet/BulkUpdateTimesheets

POST/api/services/app/TimeSheet/BulkInsertTimesheets

POST/api/services/app/TimeSheet/EditTimeSheet

POST/api/services/app/TimeSheet/EditEndTimeSheet

DELETE/api/services/app/TimeSheet/DeleteTimeSheet

POST/api/services/app/TimeSheet/BulkUnapproveTimesheets

POST/api/services/app/TimeSheet/BulkApproveTimesheets

POST/api/services/app/TimeSheet/ApproveTimesheet

POST/api/services/app/TimeSheet/UnapproveTimesheet

GET/api/services/app/TimeSheet/GetBillableTimesheetsForProjectCreatedBetweenDates

GET/api/services/app/TimeSheet/GetBillableTimesheetsForProjectGroupCreatedBetweenDates

GET/api/services/app/TimeSheet/GetStaffTimesheetStatus

GET/api/services/app/TimeSheet/GetAllTimeSheetByProjectId

GET/api/services/app/TimeSheet/GetTimeSheetsByUserId

GET/api/services/app/TimeSheet/GetTimeSheetsByUserIdAndDate

GET/api/services/app/TimeSheet/GetTimeSheetsByUserIdAndDateRange

GET/api/services/app/TimeSheet/GetTimeSheetById

GET/api/services/app/TimeSheet/GetTimeSheetSummary

GET/api/services/app/TimeSheet/GetAllTimeSheetsInDateRange

GET/api/services/app/TimeSheet/GetTimeSheetsByUserIdAndIncomplete

GET/api/services/app/TimeSheet/GetTimeSheetsByUserIdProjectIdTaskIdIncomplete

GET/api/services/app/TimeSheet/GetTimeSheetsForMob2

GET/api/services/app/TimeSheet/GetTimeSheetsInRangeForMobile

GET/api/services/app/TimeSheet/GetTimeSheetNoteById

GET/api/services/app/TimeSheet/GetTimeSheetsExternal

POST/api/services/app/TimeSheet/RevertToDraft

#### ToDoList

GET/api/services/app/ToDoList/GetToDoList

GET/api/services/app/ToDoList/GetToDoListIndex

POST/api/services/app/ToDoList/UndoCompleteTemplateToDo

GET/api/services/app/ToDoList/GetIndex

GET/api/services/app/ToDoList/GetToDoListForIndex

POST/api/services/app/ToDoList/AddOrUpdateToDoList

POST/api/services/app/ToDoList/AddToDoListAndGetId

PUT/api/services/app/ToDoList/UpdateToDoListQuoteId

POST/api/services/app/ToDoList/AddTemplateToDoListAndGetId

GET/api/services/app/ToDoList/GetTemplateToDoDtoById

GET/api/services/app/ToDoList/GetToDoById

GET/api/services/app/ToDoList/GetToDoDtoById

POST/api/services/app/ToDoList/SetUserIdForTodo

POST/api/services/app/ToDoList/DuplicateToDoListWhenAcceptQuoteAndCreateProject

PUT/api/services/app/ToDoList/UpdateToDoListProjectId

GET/api/services/app/ToDoList/GetToDoPriorities

POST/api/services/app/ToDoList/CompleteTemplateToDo

DELETE/api/services/app/ToDoList/DeleteAsync

DELETE/api/services/app/ToDoList/DeleteTemplateToDoAsync

POST/api/services/app/ToDoList/CompleteToDo

POST/api/services/app/ToDoList/UndoCompleteToDo

PUT/api/services/app/ToDoList/UpdatePriority

PUT/api/services/app/ToDoList/UpdateDueDate

GET/api/services/app/ToDoList/GetToDoListForApp

PUT/api/services/app/ToDoList/UpdateToDoListFromSchedule

#### TokenAuth

POST/api/TokenAuth/Authenticate

POST/api/TokenAuth/ExternalAuthenticate

GET/api/TokenAuth/TestNotification

#### UserSharedExternal

GET/api/services/app/UserSharedExternal/GetAllUsers

#### UserTask

GET/api/services/app/UserTask/GetTasksNotAssignedToUser

GET/api/services/app/UserTask/GetTemplateTasksNotAssignedToUser

#### Warehouse

GET/api/services/app/Warehouse/GetWarehouseById

POST/api/services/app/Warehouse/AddOrEditWarehouse

GET/api/services/app/Warehouse/GetAllWarehouses

GET/api/services/app/Warehouse/GetWarehouses

GET/api/services/app/Warehouse/GetDefaultWarehouseId

#### WeeklyTimeSheet

GET/api/services/app/WeeklyTimeSheet/GetTimesheetsInRage

#### WorkflowDocument

GET/api/services/app/WorkflowDocument/GetDocumentsForDropDown

#### WorkPattern

GET/api/services/app/WorkPattern/GetAsync

GET/api/services/app/WorkPattern/GetAllAsync

POST/api/services/app/WorkPattern/CreateAsync

PUT/api/services/app/WorkPattern/UpdateAsync

DELETE/api/services/app/WorkPattern/DeleteAsync